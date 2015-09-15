let passport = require('passport')
let LocalStrategy = require('passport-local').Strategy
let FacebookStrategy = require('passport-facebook').Strategy
let TwitterStrategy = require('passport-twitter').Strategy
let nodeifyit = require('nodeifyit')
let User = require('../models/user')
let util = require('util')
let crypto = require('crypto')
require('songbird')

let SALT = 'CodePathHeartNodeJS'

passport.use('local-signup', new LocalStrategy({
    usernameField: 'email',
    failureFlash: true,
    passReqToCallback: true
}, nodeifyit(async (req, email, password) => {
    console.log('starting signup')
    email = (email || '').toLowerCase()
    // Is the email taken?
    if (await User.promise.findOne({email})) {
        return [false, {message: 'That email is already taken.'}]
    }

    // create the user
    let user
    if (req.user) {
        console.log('req.user: ', req.user)
        user = req.user
    } else {
        user = new User
    }
    user.local.email = email
    user.local.password = (await crypto.promise.pbkdf2(password, SALT, 4096, 512, 'sha256')).toString('hex')

    try {
        return await user.save()
    } catch (e) {
        console.log(util.inspect(e))
        return [false, {message: e.message}]
    }
}, {spread: true})))

passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    failureFlash: true
}, nodeifyit(async (email, password) => {
    console.log('starting authenticating')
    email = email.toLowerCase()
    let user
    if (email.indexOf('@') > 0) {
        user = await User.promise.findOne({'local.email': email})
    }

    if (!user) {
        return [false, {message: 'User could not be found'}]
    }

    let passwordHash = await crypto.promise.pbkdf2(password, SALT, 4096, 512, 'sha256')
    if (passwordHash.toString('hex') != user.local.password) {
        return [false, {message: 'Invalid password'}]
    }

    console.log('authenticated!')
    return user
}, {spread: true})))


function useExternalPassportStrategy(OauthStrategy, config, field) {
    config.passReqToCallback = true
    passport.use(new OauthStrategy(config, nodeifyit(authCB, {spread: true})))

    async function authCB(req, token, secret, account) {
        // secretKey is only for twitter

/*
        console.log('Account: ', account)
*/

        // account.provider is 'facebook' or 'twitter'
        let provider = account.provider
        let searchKey = provider + '.id'
        let user
        console.log('secret: ', secret)
        if (req.user) {
            // 2. If req.user exists, we're authorizing (connecting an account)
            // 2a. Ensure it's not associated with another account
            // 2b. Link account
            console.log('req.user: ', req.user)
            user = req.user
            if (provider === 'facebook') {
                user.facebook.id = account.id
                user.facebook.token = token
                user.facebook.name = account.displayName
                user.facebook.email = account.email // email is not defined
                return await user.save();
            } else if (provider === 'twitter') {
                user.twitter.id = account.id;
                user.twitter.token = token;
                user.twitter.name  = account.displayName
                user.twitter.secret = secret
                return await user.save();
            }
        } else {
            // 3. If not, we're authenticating (logging in)
            // 1. Load user from store

            let user = await User.promise.findOne({ searchKey : account.id})
            if (user) {
                // 3a. If user exists, we're logging in via the 3rd party account
                console.log('got user: ', user)
                if (provider === 'facebook') {
                    console.log('facebook account and token: ', account, token)
                    user.facebook.id = account.id
                    user.facebook.token = token
                    user.facebook.name = account.displayName
                    user.facebook.email = account.email // email is not defined
                    return await user.save();
                } else if (provider === 'twitter') {
                    console.log('twitter account and token: ', account, token)
                    user.twitter.id = account.id;
                    user.twitter.token = token;
                    user.twitter.name  = account.displayName
                    user.twitter.secret = secret
                    return await user.save();
                }
                return user;
            } else {
                // 3b. Otherwise create a user associated with the 3rd party account
                console.log('no user found!')
                try {
                    user = new User;
                    // TODO: Need to refactor
                    if (account.provider === 'facebook') {
                        user.facebook.id = account.id;
                        user.facebook.token = token;
                        user.facebook.name  = account.displayName
                        return await user.save();
                    } else if (account.provider === 'twitter') {
                        user.twitter.id = account.id;
                        user.twitter.token = token;
                        user.twitter.name  = account.displayName
                        user.twitter.secret = secret
                        return await user.save();
                    }

                } catch (e) {
                    console.log(e, e.message)
                }
            }
        }
    }
}


function configure(config) {
    // Required for session support / persistent login sessions
    passport.serializeUser(nodeifyit(async (user) => {
        return user._id
    }))

    passport.deserializeUser(nodeifyit(async (id) => {
        return await User.promise.findById(id)
    }))

    useExternalPassportStrategy(FacebookStrategy, {
        clientID: config.facebook.consumerKey,
        clientSecret: config.facebook.consumerSecret,
        callbackURL: config.facebook.callbackUrl
    }, 'facebook')

     useExternalPassportStrategy(TwitterStrategy, {
         consumerKey: config.twitter.consumerKey,
         consumerSecret: config.twitter.consumerSecret,
         callbackURL: config.twitter.callbackUrl
     }, 'twitter')

    return passport
}

module.exports = {passport, configure}
