// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
    // SPDX-License-Identifier: Apache-2.0

    async function queryOidcUrl(url, setTls) {
        if ( setTls === true ) {
            const tlsOptions = {
                    secureContext: tls.createSecureContext({minVersion: 'TLSv1.2'})
            }
            return new Promise((resolve) => {
                https.get(url, tlsOptions, resp => {
                    let respData = ''
                    resp.on('data', data => {
                        respData += data
                    })

                    resp.on('end', () => {
                        resolve(JSON.parse(respData))
                    })
                })
                .on('error', err => {
                    resolve(err)
                })
            })
        } else {
            return new Promise((resolve) => {
                https.get(url, resp => {
                    let respData = ''
                    resp.on('data', data => {
                        respData += data
                    })

                    resp.on('end', () => {
                        resolve(JSON.parse(respData))
                    })
                })
                .on('error', err => {
                    resolve(err)
                })
            })
        }
    }

    const authMiddleware = async (req, res, next) => {
        const isUnset = (value) => value === null || value === '' || value === undefined
        const sendUnauthorizedResponse = (message) => {
            res.status(401).send(message)
        }

        // Check that auth header exists
        const authHeader = req.get('Authorization')
        if ( isUnset(authHeader) ) {
            return sendUnauthorizedResponse('Missing authorization header')
        }

        // Check that auth header type is Bearer
        const authHeaderContents = authHeader.split(" ")
        if ( authHeaderContents.length !== 2 ) {
            return sendUnauthorizedResponse('Malformed authorization header')
        }
        if ( authHeaderContents[0].toLowerCase() !== 'bearer' ) {
            return sendUnauthorizedResponse('Invalid authorization header')
        }

        // Check that token included in header
        if ( isUnset(authHeaderContents[1]) ) {
            return sendUnauthorizedResponse('Malformed token')
        }

        // Check that token format is correct
        const tokenContents = authHeaderContents[1].split(".")
        if ( tokenContents.length !== 3 ) {
            return sendUnauthorizedResponse('Partial malformed token received')
        }
        const tokenHeader = Buffer.from(tokenContents[0], 'base64').toString()
        if ( isUnset(tokenHeader) ) {
            return sendUnauthorizedResponse('Missing token header')
        }
        const header = JSON.parse(tokenHeader)
        if ( isUnset(header) ) {
            return sendUnauthorizedResponse('Failed parsing token header')
        }

        const tokenPayload = Buffer.from(tokenContents[1], 'base64').toString()
        if ( isUnset(tokenPayload) ) {
            return sendUnauthorizedResponse('Missing token payload')
        }
        const payload = JSON.parse(tokenPayload)
        if ( isUnset(payload) ) {
            return sendUnauthorizedResponse('Failed parsing token payload')
        }

        if ( isUnset(tokenContents[2]) ) {
            return sendUnauthorizedResponse('Missing token signature')
        }

        // Check that token is not expired
        const currentTimeSecs = Math.floor(Date.now()/1000)
        const expTimeSecs = payload.exp
        if ( isUnset(expTimeSecs) ) {
            return sendUnauthorizedResponse('Token missing expiration time')
        }
        if ( expTimeSecs <= currentTimeSecs ) {
            return sendUnauthorizedResponse('Token is expired')
        }

        const issueTimeSecs = payload.iat
        if ( isUnset(issueTimeSecs) ) {
            return sendUnauthorizedResponse('Token missing issued time')
        }
        if ( issueTimeSecs >= currentTimeSecs || issueTimeSecs >= expTimeSecs ) {
            return sendUnauthorizedResponse('Token issue time malformed')
        }

        const notBeforeTimeSecs = payload.nbf
        if ( isUnset(notBeforeTimeSecs) ) {
            return sendUnauthorizedResponse('Token missing not before time')
        }
        if ( notBeforeTimeSecs >= currentTimeSecs || notBeforeTimeSecs >= expTimeSecs ) {
            return sendUnauthorizedResponse('Token not yet valid')
        }

        // Check the algorithm used for token
        const headerType = header.typ
        if ( headerType !== 'JWT' ) {
            return sendUnauthorizedResponse('Invalid token type')
        }
        const tokenAlg = header.alg
        if ( isUnset(tokenAlg) ) {
            return sendUnauthorizedResponse('Missing token algorithm details')
        }
        if ( !tokenAlg.startsWith('HS') && !tokenAlg.startsWith('ES') && !tokenAlg.startsWith('RS') && !tokenAlg.startsWith('PS') ) {
            return sendUnauthorizedResponse('Invalid algorithm provided')
        }

        // Validate token signature
        var key = ''
        if ( tokenAlg.startsWith('HS') ) {
            key = process.env.SHARED_SECRET_KEY
        } else if ( tokenAlg.startsWith('ES') || tokenAlg.startsWith('PS') || tokenAlg.startsWith('RS') ) {
            const keyId = tokenHeader.kid
            if ( isUnset(keyId) ) {
                return sendUnauthorizedResponse('Missing key ID in token header')
            }

            const oidcUrl = process.env.OIDC_SERVER_URL
            const oidcTlsInsecureSkipVerify = process.env.OIDC_TLS_INSECURE_SKIP_VERIFY
            var openIdProvider = new Object()
            const url = oidcUrl+'/well-known/openid-configuration'
            const oidcResponse = await queryOidcUrl(url, oidcTlsInsecureSkipVerify)
            oidcResponse
                .then((result) => {
                    openIdProvider = result
                })
                .catch((error) => {
                    return sendUnauthorizedResponse('Failed to read OIDC URL' + error)
                })

            var keyList = new Object()
            const oidcKeyResponse = await queryOidcUrl(openIdProvider.jwks_uri, false)
            oidcKeyResponse
                .then((result) => {
                    openIdProvider = result
                })
                .catch((error) => {
                    return sendUnauthorizedResponse('Failed to read keys: ' + error)
                })

            for ( let loopCount = 0; loopCount < keyList.length; loopCount++ ) {
                if ( keyList[loopCount].keys.kid === keyId ) {
                    key = keyList[loopCount].keys.key
                    break
                }
            }
        }
        if ( key === '' ) {
            return sendUnauthorizedResponse('Failed to find public key')
        }

        const tokenAlgSize = tokenAlg.substring(2)
        if ( tokenAlgSize !== '256' && tokenAlgSize !== '384' && tokenAlgSize !== '512' ) {
            return sendUnauthorizedResponse('Unsupported size')
        }

        const hashList = crypto.getHashes()
        var algHash = ''
        for ( let loopCount = 0; loopCount < hashList.length; loopCount++ ) {
            if ( hashList[loopCount].includes('HMAC') && hashList[loopCount].includes(tokenAlgSize) && tokenAlg.startsWith('HS') ) {
                algHash = hashList[loopCount]
                break
            } else if ( hashList[loopCount].startsWith('ES') && hashList[loopCount].includes(tokenAlgSize) && tokenAlg.startsWith('ES') ) {
                algHash = hashList[loopCount]
                break
            } else if ( hashList[loopCount].startsWith('PS') && hashList[loopCount].includes(tokenAlgSize) && tokenAlg.startsWith('PS') ) {
                algHash = hashList[loopCount]
                break
            } else if ( hashList[loopCount].startsWith('RS') && hashList[loopCount].includes(tokenAlgSize) && tokenAlg.startsWith('RS') ) {
                algHash = hashList[loopCount]
                break
            }
        }
        if ( algHash === '' ) {
            return sendUnauthorizedResponse('Unsupported hash')
        }

        const sigVerify = crypto.createVerify(algHash)
        sigVerify.write(tokenContents[0]+'.'+tokenContents[1])
        sigVerify.end()
        if ( !sigVerify.verify(key, tokenContents[2], 'base64' ) ) {
            return sendUnauthorizedResponse('Invalid token')
        }

        next()
    }

    export default authMiddleware
