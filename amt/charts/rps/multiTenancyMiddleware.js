// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
    // SPDX-License-Identifier: Apache-2.0

    const multiTenancyMiddleware = async (req, res, next) => {
        const isNullOrEmpty = (value) => value === null || value === ''
        const isUndefined = (value) => value === undefined
        const sendUnauthorizedResponse = (message) => {
            res.status(401).send(message)
        }
        // Check if NB API call
        const apiUrl = req.originalUrl
        if ( apiUrl.includes('admin/domains') ) {
            // If NB check if header ActiveProjectID found
            const tenantId = req.get('ActiveProjectID')
            if ( isNullOrEmpty(tenantId) || isUndefined(tenantId) ) {
                return sendUnauthorizedResponse('ActiveProjectID header not found')
            }

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
            var roleCheck = true
            if ( apiMethod === 'DELETE' || apiMethod === 'PATCH' || apiMethod === 'POST' ) {
                for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
                    if ( accessRoles[loopCount].includes('im-rw') && accessRoles[loopCount].startsWith(tenantId) ) {
                        roleCheck = true
                        break
                    }
                }
            } else if ( apiMethod === 'GET' ) {
                for ( let loopCount = 0; loopCount < accessRoles.lenth; loopCount++ ) {
                    if ( accessRoles[loopCount].includes('im-r') && accessRoles[loopCount].startsWith(tenantId) ) {
                        roleCheck = true
                        break
                    }
                }
            }
            if ( !roleCheck ) {
                return sendUnauthorizedResponse('Required access not found')
            }
            req.tenantId = tenantId
        }

        next()
    }

    export default multiTenancyMiddleware
