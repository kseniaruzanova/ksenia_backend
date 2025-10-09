import { Router } from "express";

import { catchAsync } from "../lib/catchAsync";
import { userLogin, refreshToken, verifyToken } from "../controllers/auth.controller";

const router: Router = Router();

router.post('/login', catchAsync(userLogin));
router.get('/verify', catchAsync(verifyToken));
router.post('/refresh', catchAsync(refreshToken));

export default router; 
