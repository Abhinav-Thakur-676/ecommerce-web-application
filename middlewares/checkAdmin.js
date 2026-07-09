module.exports = function(req , res , next)
{
    if(req.session.is_admin)
    {
        next();
        return;
    }

    res.redirect("/admin/login");
};
