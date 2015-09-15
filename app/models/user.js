let _ = require('lodash')
let mongoose = require('mongoose')

let userSchema = mongoose.Schema({
    local: {
        email: {
            type: String
        },
        password:  {
            type: String
        }
    },
    facebook: {
        id: String,
        token: String,
        email: String,
        name: String
    },
    twitter: {
        id: String,
        token: String,
        name: String,
        secret: String
    }
})

userSchema.methods.linkAccount = function(type, values) {
    return this['link'+_.capitalize(type)+'Account'](values)
}

userSchema.methods.linkLocalAccount = async function({email, password}) {
    throw new Error('Not Implemented.')
}
userSchema.methods.linkFacebookAccount = async function({account, token}) {
    throw new Error('Not Implemented.')
}
userSchema.methods.linkTwitterAccount = function({account, token}) {
    throw new Error('Not Implemented.')
}

userSchema.methods.unlinkAccount = function(type) {
    throw new Error('Not Implemented.')
}

module.exports = mongoose.model('User', userSchema)