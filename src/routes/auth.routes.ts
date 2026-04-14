import { Router } from "express";

import { catchAsync } from "../lib/catchAsync";
import {
  userLogin,
  refreshToken,
  userRegister,
  verifyRegistrationCode,
  verifyToken,
  clubUserRegister,
  clubVerifyRegistrationCode,
  clubUserLogin
} from "../controllers/auth.controller";

const router: Router = Router();

router.post('/register', catchAsync(userRegister));
router.post('/register/verify-code', catchAsync(verifyRegistrationCode));
router.post('/login', catchAsync(userLogin));

router.post('/club/register', catchAsync(clubUserRegister));
router.post('/club/register/verify-code', catchAsync(clubVerifyRegistrationCode));
router.post('/club/login', catchAsync(clubUserLogin));
router.get('/verify', catchAsync(verifyToken));
router.post('/refresh', catchAsync(refreshToken));

export default router; 
