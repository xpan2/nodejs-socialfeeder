let _ = require('lodash')
let then = require('express-then')
let Twitter = require('twitter')
let isLoggedIn = require('./middlewares/isLoggedIn')
let posts = require('../data/posts')

let networks = {
    twitter: {
        network: {
            icon: 'twitter',
            name: 'twitter',
            class: 'btn-primary'
        }
    }
}

module.exports = (app) => {
    let passport = app.passport
    let twitterConfig = app.config.auth.twitter

    app.get('/', (req, res) => res.render('index.ejs'))

    app.get('/signup', (req, res) => {
        res.render('signup.ejs', {message: req.flash('error') })
    })

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/profile',
        failureRedirect: '/signup',
        failureFlash: true
    }))

    app.get('/profile', isLoggedIn, (req, res) => {
        console.log('getting profile')
        console.log(req.user)
        res.render('profile.ejs', {
            user: req.user,
            message: req.flash('error')
        })
    })

    app.get('/login', (req, res) => {
        res.render('login.ejs', {message: req.flash('error')})
    })

    // Authenticate
    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/profile',
        failureRedirect: '/login',
        failureFlash: true
    }))

    app.get('/connect/local', (req, res) => {
        res.render('connect-local.ejs', {
            message: req.flash('error')
        })
    })

    app.get('/logout', (req, res) => {
        req.logout()
        res.redirect('/')
    })

    app.get('/compose', isLoggedIn, (req, res) => {
        res.render('compose.ejs', {
            message: req.flash('error')
        })
    })

    app.post('/compose', isLoggedIn, then(async(req, res) => {
        try {
            let status = req.body.reply;
            let payload = status
            updateStatus(req, payload)

            res.redirect('/timeline')
        } catch (e) {
            console.log(e)
        }
    }))

    app.post('/like/:id', isLoggedIn, then(async (req, res, next) => {
        try {
            let id = req.params.id
            console.log('id:', id)
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.secret
            })
            await twitterClient.promise.post('favorites/create', {id})
            res.end()
        } catch (e) {
            console.log(e)
        }
    }))

    app.post('/unlike/:id', isLoggedIn, then(async (req, res, next) => {
        try {
            let id = req.params.id
            console.log('id:', id)
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.secret
            })
            await twitterClient.promise.post('favorites/destroy', {id})
            res.end()
        } catch (e) {
            console.log(e)
        }
    }))


    app.get('/reply/:id', isLoggedIn, then(async(req, res) => {
        redirectTo(req, res, 'reply.ejs')
    }))


    app.get('/share/:id', isLoggedIn, then(async(req, res) => {
        redirectTo(req, res, 'share.ejs')
    }))

    var redirectTo = function (req, res, template) {
        async() => {
            let id = req.params.id;
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.secret
            })
            let [tweet] = await twitterClient.promise.get('/statuses/show/'+id);
            let post = {
                id : tweet.id_str,
                image: tweet.user.profile_image_url,
                text: tweet.text,
                name: tweet.user.name,
                username: '@'+tweet.user.screen_name,
                liked: tweet.favorited,
                network: networks.twitter
            }
            res.render(template, {
                message: req.flash('error'),
                post: post
            })
        }()
    }

    app.post('/reply/:id', isLoggedIn, then(async(req, res) => {
        let status = req.body.reply
        let payload = {
            status: status,
            in_reply_to_status_id: req.params.id
        }
        updateStatus(req, payload)

        res.redirect('/timeline')
    }))

    app.post('/share/:id', isLoggedIn, then(async(req, res) => {
        try {
            let status = req.body.share
            console.log('status: ', status)
            let id = req.params.id
            if (status.length > 140){
                req.flash('error', 'length cannot be greater than 140 characters')
            }
            if (status.length === 0){
                req.flash('error', 'Status cannot be empty')
            }
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.secret
            })
            await twitterClient.promise.post('/statuses/retweet/'+id, {status: status})
            res.redirect('/timeline')
        } catch (e) {
            console.log(e)
        }
    }))


    var updateStatus = function (req, payload) {
        async () => {
            let status = req.body.reply
            if (status.length > 140){
                req.flash('error', 'length cannot be greater than 140 characters')
            }
            if (!status.length){
                req.flash('error', 'Status cannot be empty')
            }
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.secret
            })
            await twitterClient.promise.post('/statuses/update', payload);
        }()
    }

/* copied from video */
/*
    app.get('/unlink/twitter', isLoggedIn, then(async (req, res, next) => {
        await req.user.unlinkAccount(twitter);
        let stillLoggedIn = _.any(validTypes, type => {
            if (type === 'local') return req.user[type].email;
            return req.user[type] && req.user[type].id;
        })
        // Stay logged in if they still have linked accounts
        if (stillLoggedIn) {
            return res.redirect('/profile');
        }
        await req.user.remove()
        req.logout();
        req.redirect('/')
    }))
*/
    app.get('/timeline', isLoggedIn, then (async (req, res) => {
      try {
//          console.log(req.user.twitter)
          let twitterClient = new Twitter({
              consumer_key: twitterConfig.consumerKey,
              consumer_secret: twitterConfig.consumerSecret,
              access_token_key: req.user.twitter.token,
              access_token_secret: req.user.twitter.secret
          })

          let [tweets] = await twitterClient.promise.get('statuses/home_timeline')

          tweets = tweets.map(tweet => {
            return {
                id: tweet.id_str,
                image: tweet.user.profile_image_url,
                text: tweet.text,
                name: tweet.user.name,
                username: '@' + tweet.user.screen_name,
                liked: tweet.favorited,
                network: networks.twitter
            }})

          res.render('timeline.ejs', {
            posts: tweets
          })
      } catch (e) {
        console.log('error')
        console.log(e)
      }
    }))

    // Scope specifies the desired data fields from the user account
    let scope = ['email', 'user_likes', 'publish_actions']

    // Authentication route & Callback URL
    app.get('/auth/facebook', passport.authenticate('facebook', {scope: scope}))
    app.get('/auth/facebook/callback', passport.authenticate('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authorization route & Callback URL
    app.get('/connect/facebook', passport.authorize('facebook', {scope: scope}))
    app.get('/connect/facebook/callback', passport.authorize('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authentication route & Callback URL
    app.get('/auth/twitter', passport.authenticate('twitter', {scope: 'email'}))
    app.get('/auth/twitter/callback', passport.authenticate('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authorization route & Callback URL
    app.get('/connect/twitter', passport.authorize('twitter', {scope: 'email'}))
    app.get('/connect/twitter/callback', passport.authorize('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))
}
