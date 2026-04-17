// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
    // SPDX-License-Identifier: Apache-2.0

    // Queries the project service API to resolve a project UUID from a project name.
    // Mirrors the behaviour of ResolveProjectUUID in orch-library/go/pkg/middleware/projectcontext.
    const resolveProjectUUID = async (projectName, authHeader, projectServiceURL) => {
        const reqURL = `${projectServiceURL}/v1/projects?member-role=true`
        const headers = {}
        if ( authHeader ) {
            headers['Authorization'] = authHeader
        }
        const resp = await fetch(reqURL, { method: 'GET', headers })
        if ( !resp.ok ) {
            throw new Error(`Project service returned status ${resp.status}`)
        }
        const projects = await resp.json()
        for ( const project of projects ) {
            if ( project.name === projectName ) {
                return project?.status?.projectStatus?.uID ?? ''
            }
        }
        throw new Error(`Project not found: ${projectName}`)
    }

    const multiTenancyMiddleware = async (req, res, next) => {
        const isNullOrEmpty = (value) => value === null || value === ''
        const isUndefined = (value) => value === undefined
        const sendUnauthorizedResponse = (message) => {
            res.status(401).send(message)
        }
        // Check if NB API call
        const apiUrl = req.originalUrl
        const deviceApi = apiUrl.includes('devices/')
        var deviceIdApi = true
        if ( deviceApi ) {
            if ( apiUrl.includes('stats') || apiUrl.includes('redirectStatus') || apiUrl.includes('disconnect') || apiUrl.includes('refresh') ) {
                deviceIdApi = false
            } else if ( apiUrl === 'devices' ) {
                deviceIdApi = false
            }
        }
        if ( apiUrl.includes('generalSettings') || ( deviceApi && deviceIdApi ) ) {
            // If NB check if header ActiveProjectID found
            const tenantId = req.get('ActiveProjectID')
            if ( isNullOrEmpty(tenantId) || isUndefined(tenantId) ) {
                const projectMatch = apiUrl.match(/\/v1\/projects\/([^/]+)/)
                if ( projectMatch ) {
                    const projectName = projectMatch[1]
                    const projectServiceURL = process.env.NEXUS_API_URL || 'http://localhost:8082'
                    const authHeader = req.get('Authorization') || ''
                    try {
                        const projectUUID = await resolveProjectUUID(projectName, authHeader, projectServiceURL)
                        if ( isNullOrEmpty(projectUUID) || isUndefined(projectUUID) ) {
                            return sendUnauthorizedResponse('Failed to resolve project UUID')
                        }
                        req.headers['activeprojectid'] = projectUUID
                    } catch (err) {
                        return sendUnauthorizedResponse(`Failed to resolve project UUID: ${err.message}`)
                    }
                } else {
                    return sendUnauthorizedResponse('ActiveProjectID header not found')
                }                
            }

            const userAgent = req.get('User-Agent')
            if ( userAgent !== 'dm-manager') {
                // Check for auth header and decode access roles
                const authHeader = req.get('Authorization')
                if ( isNullOrEmpty(authHeader) || isUndefined(authHeader) ) {
                    return sendUnauthorizedResponse('Unauthorized request')
                }
                const authHeaderContents = authHeader.split(" ")
                if ( authHeaderContents.length !== 2 ) {
                    return sendUnauthorizedResponse('Malformed authorization header')
                }
                if ( authHeaderContents[0].toLowerCase() !== 'bearer' ) {
                    return sendUnauthorizedResponse('Invalid authorization header')
                }

                const tokenContents = authHeaderContents[1].split(".")
                const claims = Buffer.from(tokenContents[1], 'base64').toString()
                const claimPayload = JSON.parse(claims)
                const access = claimPayload.realm_access.roles
                const accessList = new String(access)
                const accessRoles = accessList.split(",")
                if ( isNullOrEmpty(accessRoles) || isUndefined(accessRoles) ) {
                    return sendUnauthorizedResponse('Malformed token')
                }

                // Verify that token has access to tenant roles
                var tenantAccess = false
                for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
                    if ( accessRoles[loopCount].startsWith(tenantId) ) {
                        tenantAccess = true
                        break
                    }
                }
                if ( !tenantAccess ) {
                    return sendUnauthorizedResponse('Access not found')
                }

                // Verify correct access for method
                const apiMethod = req.method
                var roleCheck = false
                if ( apiMethod === 'DELETE' ) {
                    for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
                        if ( accessRoles[loopCount].includes('im-rw') && accessRoles[loopCount].startsWith(tenantId) ) {
                            roleCheck = true
                            break
                        }
                    }
                } else if ( apiMethod === 'GET' ) {
                    for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
                        if ( accessRoles[loopCount].includes('im-r') && accessRoles[loopCount].startsWith(tenantId) ) {
                            roleCheck = true
                            break
                        }
                    }
                }
                if ( !roleCheck ) {
                    return sendUnauthorizedResponse('Required access not found')
                }
            }
            req.tenantId = tenantId
        }

        next()
    }

    export default multiTenancyMiddleware
