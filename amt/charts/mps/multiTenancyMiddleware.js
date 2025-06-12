// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

const multiTenancyMiddleware = async (req, res, next) => {
    const isNullOrEmpty = (value) => value === null || value === ''
    const sendUnauthorizedResponse = () => {
        res.status(401).send('Unauthorized')
    }
    // Check if NB API call
    const apiUrl = req.originalUrl
    const deviceApi = apiUrl.includes('devices')
    const deviceIdApi = true
    if ( deviceApi ) {
        if ( apiUrl.includes('stats') || apiUrl.includes('redirectStatus') || apiUrl.includes('disconnect') || apiUrl.includes('refresh') ) {
            deviceIdApi = false
        } else if ( !apiUrl.includes('devices/') ) {
            deviceIdApi = false
        }
    }
    if ( apiUrl.includes('generalSettings') || ( deviceApi && deviceIdApi ) ) {
        // If NB check if header ActiveProjectID found
        const tenantId = req.headers['ActiveProjectID']
        if ( isNullOrEmpty(tenantId) ) {
            return sendUnauthorizedResponse()
        }

        // Check for auth header and decode access roles
        const authHeader = req.headers['Authorization']
        if ( isNullOrEmpty(authHeader) ) {
            return sendUnauthorizedResponse()
        }
        const authHeaderContents = authHeader.split(" ")
        if ( authHeaderContents.length !== 3 ) {
            return sendUnauthorizedResponse()
        }
        if ( !authHeaderContents[1].includes['bearer'] && !authHeaderContents[1].includes['Bearer'] ) {
            return sendUnauthorizedResponse()
        }

        const tokenContents = authHeaderContents[2].split(".")
        const claims = Buffer.from(tokenContents[1], 'base64').toString()
        const claimPayload = JSON.parse(claims)
        const access = claimPayload.realm_access.roles
        const accessRoles = access.split(",")
        if ( isNullOrEmpty(accessRoles) ) {
            return sendUnauthorizedResponse()
        }

        // Verify that token has access to tenant roles
        var tenantAccess = false
        for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
            if ( accessRoles[loopCount].includes(tenantId) ) {
                tenantAccess = true
                loopCount = accessRoles.length
            }
        }
        if ( !tenantAccess ) {
            return sendUnauthorizedResponse()
        }

        // Verify correct access for method
        const apiMethod = req.apiMethod
        var roleCheck = false
        if ( apiMethod === 'DELETE' ) {
            for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
                if ( accessRoles[loopCount].includes('im-rw') ) {
                    roleCheck = true
                    loopCount = accessRoles.length
                }
            }
        } else if ( apiMethod === 'GET' ) {
            for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
                if ( accessRoles[loopCount].includes('im-r') ) {
                    roleCheck = true
                    loopCount = accessRoles.length
                }
            }
        }
        if ( !roleCheck ) {
            return sendUnauthorizedResponse()
        }
    }

    next()
}

export default multiTenancyMiddleware