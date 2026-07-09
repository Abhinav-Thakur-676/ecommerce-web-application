function checkAuth(req , res , next)
{
  if(req.session.is_logged_in && 
    req.session.user &&
    req.session.user.isVarified)
  {
    next();
    return
  }
  
  res.redirect("/login");
}

module.exports = checkAuth;