import { Router } from "express";

import { catchAsync } from "../lib/catchAsync";
import { getTarotReading } from "../controllers/tarot.controller";

const router: Router = Router();

router.post("/", catchAsync(getTarotReading));

export default router;
