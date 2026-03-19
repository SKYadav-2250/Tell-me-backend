const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');

router.post('/signup',()=>{
    console.log("request is coming here also");
} ,signup);
router.post('/login', login);

module.exports = router;
