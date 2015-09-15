module.exports = function isLoggedIn(req, res, next) {
  console.log('isLoggedIn?')
  if (req.isAuthenticated()) return next()

  res.redirect('/')
}
