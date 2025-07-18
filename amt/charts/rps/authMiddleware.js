// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
    // SPDX-License-Identifier: Apache-2.0
    import { constants, createHmac, createPublicKey, createVerify } from "crypto"
    import { createSecureContext } from "tls"
    import { get } from "http"
    import { OidcServerUrl, OidcTlsInsecureSkipVerify } from '../../../../middleware/middleware-constants.js'

    const allowedOidcUrls = ['http://platform-keylcoak.orch-platform/realms/master', 'http://platform-keycloak.orch-platform.svc/realms/master']
    const publicKeys = new Map()

    async function queryOidcUrl(url, setTls) {
        if ( setTls === true ) {
            const tlsOptions = {
                    secureContext: createSecureContext({minVersion: 'TLSv1.2'})
            }
            return new Promise((resolve) => {
                get(url, tlsOptions, resp => {
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
                get(url, resp => {
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

        const apiUrl = req.originalUrl
        if ( !apiUrl.includes('/api/v1/admin/health') ) {
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
            if ( !isUnset(notBeforeTimeSecs) ) {
                if ( notBeforeTimeSecs >= currentTimeSecs || notBeforeTimeSecs >= expTimeSecs ) {
                    return sendUnauthorizedResponse('Token not yet valid')
                }
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
                const keyId = header.kid
                if ( isUnset(keyId) ) {
                    return sendUnauthorizedResponse('Missing key ID in token header')
                }

                // Check if key already loaded, retrieve if not found
                if ( !publicKeys.has(keyId) ) {
                    if ( !allowedOidcUrls.includes(OidcServerUrl) ) {
                        return sendUnauthorizedResponse('Invalid OIDC Server Url')
                    }
                    const url = OidcServerUrl+'/.well-known/openid-configuration'
                    const oidcResponse = await queryOidcUrl(url, OidcTlsInsecureSkipVerify)

                    const jwksUri = oidcResponse.jwks_uri
                    var checkUriAllowed = false
                    for ( let loopCount = 0; loopCount < allowedOidcUrls.length; loopCount++) {
                        if ( jwksUri.startsWith(allowedOidcUrls[loopCount]) ) {
                            checkUriAllowed = true
                            break
                        }
                    }
                    if ( !checkUriAllowed ) {
                        return sendUnauthorizedResponse('Invalid JWKS URI domain')
                    }
                    const oidcKeyResponse = await queryOidcUrl(jwksUri, false)

                    // Remove old keys and add updated keys
                    const keyList = oidcKeyResponse.keys
                    publicKeys.clear()
                    for ( let loopCount = 0; loopCount < keyList.length; loopCount++ ) {
                        publicKeys.set(keyList[loopCount].kid, keyList[loopCount])
                    }
                }
                key = publicKeys.get(keyId)
            }
            if ( isUnset(key) ) {
                return sendUnauthorizedResponse('Failed to find public key')
            }

            const tokenAlgSize = tokenAlg.substring(2)
            if ( tokenAlgSize !== '256' && tokenAlgSize !== '384' && tokenAlgSize !== '512' ) {
                return sendUnauthorizedResponse('Unsupported size')
            }

            const algHash = `sha${tokenAlgSize}`
            const headerData = tokenContents[0]
            const payloadData = tokenContents[1]
            const tokenData = `${headerData}.${payloadData}`
            const publicKey = createPublicKey({key: key, format: 'jwk'})

            if ( tokenAlg.startsWith('HS') ) {
                const signVerify = createHmac(algHash, key)
                signVerify.update(tokenData)
                signVerify.end()
                if ( signVerify.digest('hex') !== Buffer.from(tokenContents[2], 'base64').toString() ) {
                    return sendUnauthorizedResponse('Token verification failed')
                }
            } else {
                if ( tokenAlg.startsWith('ES') ) {
                    const signVerify = createVerify(algHash)
                    signVerify.update(tokenData)
                    signVerify.end()
                    if ( !signVerify.verify(publicKey, tokenContents[2], 'base64') ) {
                        return sendUnauthorizedResponse('Token verification failed')
                    }
                } else if ( tokenAlg.startsWith('PS') ) {
                    const signingKey = {
                        key: publicKey,
                        padding: constants.RSA_PKCS1_PSS_PADDING,
                        saltLength: constants.RSA_PSS_SALTLEN_DIGEST
                    }
                    const signVerify = createVerify(algHash)
                    signVerify.update(tokenData)
                    signVerify.end()
                    if ( !signVerify.verify(signingKey, tokenContents[2], 'base64') ) {
                        return sendUnauthorizedResponse('Token verification failed')
                    }
                } else if ( tokenAlg.startsWith('RS') ) {
                    const signingKey = {
                        key: publicKey,
                        padding: constants.RSA_PKCS1_PADDING
                    }
                    const signVerify = createVerify(algHash)
                    signVerify.update(tokenData)
                    signVerify.end()
                    if ( !signVerify.verify(signingKey, tokenContents[2], 'base64') ) {
                        return sendUnauthorizedResponse('Token verification failed')
                    }
                } else {
                    return sendUnauthorizedResponse('Token verification failed')
                }
            }
        }

        next()
    }

    export default authMiddleware
