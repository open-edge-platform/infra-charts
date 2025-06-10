// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { jwtDecode } from 'jwt-decode'
import { verify } from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const multiTenancyMiddleware = async (req, res, next) => {
    const isNullOrEmpty = (value) => value === null || value === ''
    const sendUnauthorizedResponse = () => {
        res.status(401).send('Unauthorized')
    }

    // Check if auth header is in request
    const authHeader = req.headers['Authorization']
    if ( isNullOrEmpty(authHeader) ) {
        return sendUnauthorizedResponse()
    }

    // Validate auth header in request
    const authHeaderContents = authHeader.split(" ")
    if ( authHeaderContents.length !== 3 ) {
        return sendUnauthorizedResponse()
    }
    const authScheme = authHeaderContents[1]
    const authToken = authHeaderContents[2]
    if ( !authScheme.includes('bearer') || !authScheme.includes('Bearer') ) {
        return sendUnauthorizedResponse()
    }

    // Validate received token
    const tokenHeader = jwtDecode(authToken, { header: true })
    if ( isNullOrEmpty(tokenHeader) ) {
        return sendUnauthorizedResponse()
    }
    const tokenClaims = jwtDecode(authToken)
    if ( tokenClaims === null ) {
        return sendUnauthorizedResponse()
    }

    // Validate expiration time
    const currentTimeSecs = Math.floor(Date.now()/1000)
    const expTime = tokenClaims.exp ?? currentTimeSecs + 1
    if ( expTime > currentTimeSecs ) {
        return sendUnauthorizedResponse()
    }

    // Validate token signature
    const algMethod = tokenHeader.alg
    if ( isNullOrEmpty(algMethod) || algMethod === undefined ) {
        return sendUnauthorizedResponse()
    }
    if ( !algMethod.includes('HS') && !algMethod.includes('RS') && !algMethod.includes('PS') ) {
        return sendUnauthorizedResponse()
    }

    if ( algMethod.includes('HS') ) {
        const envKey = process.env.SHARED_SECRET_KEY ?? ''
        if ( envKey === '' ) {
            return sendUnauthorizedResponse()
        }
        const verifyResult = verify(authToken, envKey)
        if ( isNullOrEmpty(verifyResult) ) {
            return sendUnauthorizedResponse()
        }
    } else if ( algMethod.includes('RS') || algMethod.includes('PS') ) {
        const keyId = tokenHeader.kid
        const uri = process.env.OIDC_SERVER_URL ?? ''
        if ( isNullOrEmpty(keyId) || uri === '' ) {
            return sendUnauthorizedResponse()
        }
        const keyClient = jwksClient({
            jwksUri: uri
        })
        const key = await keyClient.getSigningKey(keyId)
        const signingPublicKey = key.getPublicKey()
        const verifyResult = verify(authToken, signingPublicKey)
        if ( isNullOrEmpty(verifyResult) ) {
            return sendUnauthorizedResponse()
        }
    } else {
        return sendUnauthorizedResponse()
    }

    // Verify access roles and tenant ID
    const tokenContents = authToken.split(".")
    const claims = Buffer.from(tokenContents[1], 'base64').toString()
    const claimPayload = JSON.parse(claims)
    const access = claimPayload.realm_access.roles
    const accessRoles = access.split(",")
    if ( isNullOrEmpty(accessRoles) ) {
        return sendUnauthorizedResponse()
    }

    const tenantId = req.headers['ActiveProjectID']
    if ( isNullOrEmpty(tenantId) ) {
        return sendUnauthorizedResponse()
    }
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

    const apiMethod = req.method
    var roleCheck = false
    if ( apiMethod === 'PATCH' || apiMethod === 'POST' || apiMethod === 'DELETE' ) {
        for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
            if ( accessRoles[loopCount].includes('im-rw') ) {
                loopCount = accessRoles.length
                roleCheck = true
            }
        }
    } else if ( apiMethod === 'GET' ) {
        for ( let loopCount = 0; loopCount < accessRoles.length; loopCount++ ) {
            if ( accessRoles[loopCount].includes('im-r') || accessRoles[loopCount].includes('im-rw') ) {
                loopCount = accessRoles.length
                roleCheck = true
            }
        }
    } else {
        roleCheck = false
    }
    if ( !roleCheck ) {
        return sendUnauthorizedResponse()
    }

    next()
}

export default multiTenancyMiddleware