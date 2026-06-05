/**
 * 姿勢判定エンジン（反復横跳びロジック）
 *
 * MediaPipe Pose の 33 キーポイントを使ったルールベース判定。
 * 各動作は「移動 → 中心に戻る」の往復を1工程とします。
 *
 * キーポイントインデックス（MediaPipe Pose）:
 *   0: nose
 *   11: left_shoulder, 12: right_shoulder
 *   23: left_hip,      24: right_hip
 *   25: left_knee,     26: right_knee
 *   27: left_ankle,    28: right_ankle
 */

import type { PoseLandmark, PoseLandmarks } from './types';

type MotionType = 'step_right' | 'step_left' | 'step_forward' | 'step_back' | 'jump' | 'squat' | 'turn_right' | 'turn_left' | 'raise_right' | 'raise_left' | 'balance';

// キーポイントインデックス
const KP = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
} as const;

function get(landmarks: PoseLandmarks, idx: number): PoseLandmark {
  return landmarks[idx] ?? { x: 0, y: 0, z: 0, visibility: 0 };
}

function dist2D(a: PoseLandmark, b: PoseLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const cross = ab.x * cb.y - ab.y * cb.x;
  return Math.abs(Math.atan2(Math.abs(cross), dot) * (180 / Math.PI));
}

// ===== 反復横跳びロジック =====
// 各動作は「移動フェーズ」→「戻るフェーズ」で判定
// 戻ってきた時点で成功とする

/**
 * 右ステップ：反復横跳びのように右に移動して戻る
 * - フェーズ1: 右足が左足より右に移動（x大）
 * - フェーズ2: 右足が元の位置に戻る（中心に復帰）
 */
function judgeStepRight(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevRA = get(prev, KP.RIGHT_ANKLE);
  const prevLA = get(prev, KP.LEFT_ANKLE);
  const currRA = get(curr, KP.RIGHT_ANKLE);
  const currLA = get(curr, KP.LEFT_ANKLE);
  
  // 右足が右に移動し、左足との距離が0.08以上
  const movedRight = currRA.x - prevRA.x > 0.05;
  const spreadRight = currRA.x - currLA.x > 0.08;
  
  // 右足が戻ってくる（中心に復帰）
  const returnedToCenter = Math.abs(currRA.x - currLA.x) < 0.05;
  
  return movedRight && spreadRight && returnedToCenter;
}

/**
 * 左ステップ：反復横跳びのように左に移動して戻る
 */
function judgeStepLeft(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLA = get(prev, KP.LEFT_ANKLE);
  const prevRA = get(prev, KP.RIGHT_ANKLE);
  const currLA = get(curr, KP.LEFT_ANKLE);
  const currRA = get(curr, KP.RIGHT_ANKLE);
  
  // 左足が左に移動し、右足との距離が0.08以上
  const movedLeft = prevLA.x - currLA.x > 0.05;
  const spreadLeft = currRA.x - currLA.x > 0.08;
  
  // 左足が戻ってくる（中心に復帰）
  const returnedToCenter = Math.abs(currRA.x - currLA.x) < 0.05;
  
  return movedLeft && spreadLeft && returnedToCenter;
}

/**
 * 前ステップ：前に移動して戻る
 * - z座標が減少（カメラに近づく）
 * - その後、元の位置に戻る
 */
function judgeStepForward(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevHip = get(prev, KP.LEFT_HIP);
  const currHip = get(curr, KP.LEFT_HIP);
  
  // 腰がカメラに近づく（z減少）
  const movedForward = prevHip.z - currHip.z > 0.05;
  
  // 腰が戻ってくる（元のz位置に復帰）
  const returnedToCenter = Math.abs(currHip.z - prevHip.z) < 0.03;
  
  return movedForward && returnedToCenter;
}

/**
 * 後ステップ：後に移動して戻る
 */
function judgeStepBack(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevHip = get(prev, KP.LEFT_HIP);
  const currHip = get(curr, KP.LEFT_HIP);
  
  // 腰がカメラから遠ざかる（z増加）
  const movedBack = currHip.z - prevHip.z > 0.05;
  
  // 腰が戻ってくる（元のz位置に復帰）
  const returnedToCenter = Math.abs(currHip.z - prevHip.z) < 0.03;
  
  return movedBack && returnedToCenter;
}

/** ジャンプ: 両足首のy座標が上昇（y減少）して戻る */
function judgeJump(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLA = get(prev, KP.LEFT_ANKLE);
  const prevRA = get(prev, KP.RIGHT_ANKLE);
  const currLA = get(curr, KP.LEFT_ANKLE);
  const currRA = get(curr, KP.RIGHT_ANKLE);
  
  // 両足が上昇
  const leftRise = prevLA.y - currLA.y > 0.05;
  const rightRise = prevRA.y - currRA.y > 0.05;
  
  // 両足が戻ってくる
  const leftReturned = Math.abs(currLA.y - prevLA.y) < 0.03;
  const rightReturned = Math.abs(currRA.y - prevRA.y) < 0.03;
  
  return (leftRise && rightRise) && (leftReturned && rightReturned);
}

/** スクワット: 膝角度が小さくなる（しゃがむ）して戻る */
function judgeSquat(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLHip = get(prev, KP.LEFT_HIP);
  const prevLKnee = get(prev, KP.LEFT_KNEE);
  const prevLAnkle = get(prev, KP.LEFT_ANKLE);
  const prevRHip = get(prev, KP.RIGHT_HIP);
  const prevRKnee = get(prev, KP.RIGHT_KNEE);
  const prevRAnkle = get(prev, KP.RIGHT_ANKLE);
  
  const currLHip = get(curr, KP.LEFT_HIP);
  const currLKnee = get(curr, KP.LEFT_KNEE);
  const currLAnkle = get(curr, KP.LEFT_ANKLE);
  const currRHip = get(curr, KP.RIGHT_HIP);
  const currRKnee = get(curr, KP.RIGHT_KNEE);
  const currRAnkle = get(curr, KP.RIGHT_ANKLE);
  
  const prevLeftAngle = angle(prevLHip, prevLKnee, prevLAnkle);
  const prevRightAngle = angle(prevRHip, prevRKnee, prevRAnkle);
  const currLeftAngle = angle(currLHip, currLKnee, currLAnkle);
  const currRightAngle = angle(currRHip, currRKnee, currRAnkle);
  
  // しゃがむ（膝角度が小さくなる）
  const squatted = currLeftAngle < 120 && currRightAngle < 120;
  
  // 戻る（膝角度が元に戻る）
  const returned = Math.abs(currLeftAngle - prevLeftAngle) < 15 && Math.abs(currRightAngle - prevRightAngle) < 15;
  
  return squatted && returned;
}

/** 右ターン: 右肩がカメラ側に来て戻る */
function judgeTurnRight(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLS = get(prev, KP.LEFT_SHOULDER);
  const prevRS = get(prev, KP.RIGHT_SHOULDER);
  const currLS = get(curr, KP.LEFT_SHOULDER);
  const currRS = get(curr, KP.RIGHT_SHOULDER);
  
  // 右肩がカメラ側（z小）に来る
  const turnedRight = currRS.z - currLS.z < -0.1;
  
  // 戻る
  const returned = Math.abs((currRS.z - currLS.z) - (prevRS.z - prevLS.z)) < 0.1;
  
  return turnedRight && returned;
}

/** 左ターン: 左肩がカメラ側に来て戻る */
function judgeTurnLeft(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLS = get(prev, KP.LEFT_SHOULDER);
  const prevRS = get(prev, KP.RIGHT_SHOULDER);
  const currLS = get(curr, KP.LEFT_SHOULDER);
  const currRS = get(curr, KP.RIGHT_SHOULDER);
  
  // 左肩がカメラ側（z小）に来る
  const turnedLeft = currLS.z - currRS.z < -0.1;
  
  // 戻る
  const returned = Math.abs((currLS.z - currRS.z) - (prevLS.z - prevRS.z)) < 0.1;
  
  return turnedLeft && returned;
}

/** 右足上げ: 右膝が腰より高くなって戻る */
function judgeRaiseRight(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevRHip = get(prev, KP.RIGHT_HIP);
  const prevRKnee = get(prev, KP.RIGHT_KNEE);
  const currRHip = get(curr, KP.RIGHT_HIP);
  const currRKnee = get(curr, KP.RIGHT_KNEE);
  
  // 右膝が腰より高い
  const raised = currRHip.y - currRKnee.y > 0.1;
  
  // 戻る
  const returned = Math.abs((currRHip.y - currRKnee.y) - (prevRHip.y - prevRKnee.y)) < 0.05;
  
  return raised && returned;
}

/** 左足上げ: 左膝が腰より高くなって戻る */
function judgeRaiseLeft(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLHip = get(prev, KP.LEFT_HIP);
  const prevLKnee = get(prev, KP.LEFT_KNEE);
  const currLHip = get(curr, KP.LEFT_HIP);
  const currLKnee = get(curr, KP.LEFT_KNEE);
  
  // 左膝が腰より高い
  const raised = currLHip.y - currLKnee.y > 0.1;
  
  // 戻る
  const returned = Math.abs((currLHip.y - currLKnee.y) - (prevLHip.y - prevLKnee.y)) < 0.05;
  
  return raised && returned;
}

/** 片足立ち: 片方の足首が地面から離れて戻る */
function judgeBalance(prev: PoseLandmarks, curr: PoseLandmarks): boolean {
  const prevLAnkle = get(prev, KP.LEFT_ANKLE);
  const prevRAnkle = get(prev, KP.RIGHT_ANKLE);
  const currLAnkle = get(curr, KP.LEFT_ANKLE);
  const currRAnkle = get(curr, KP.RIGHT_ANKLE);
  
  const prevDiff = Math.abs(prevLAnkle.y - prevRAnkle.y);
  const currDiff = Math.abs(currLAnkle.y - currRAnkle.y);
  
  // 片足が上がる
  const balanced = currDiff > 0.12;
  
  // 戻る
  const returned = Math.abs(currDiff - prevDiff) < 0.08;
  
  return balanced && returned;
}

// ===== メイン判定関数 =====

export function judgeMotion(
  motion: MotionType,
  prev: PoseLandmarks,
  curr: PoseLandmarks,
): boolean {
  if (!prev || !curr || prev.length < 33 || curr.length < 33) return false;

  switch (motion) {
    case 'step_right':    return judgeStepRight(prev, curr);
    case 'step_left':     return judgeStepLeft(prev, curr);
    case 'step_forward':  return judgeStepForward(prev, curr);
    case 'step_back':     return judgeStepBack(prev, curr);
    case 'jump':          return judgeJump(prev, curr);
    case 'squat':         return judgeSquat(prev, curr);
    case 'turn_right':    return judgeTurnRight(prev, curr);
    case 'turn_left':     return judgeTurnLeft(prev, curr);
    case 'raise_right':   return judgeRaiseRight(prev, curr);
    case 'raise_left':    return judgeRaiseLeft(prev, curr);
    case 'balance':       return judgeBalance(prev, curr);
    default:              return false;
  }
}

/** 骨格が十分に検出されているか確認 */
export function isPoseDetected(landmarks: PoseLandmarks): boolean {
  if (!landmarks || landmarks.length < 33) return false;
  const keyIndices = [KP.LEFT_HIP, KP.RIGHT_HIP, KP.LEFT_KNEE, KP.RIGHT_KNEE, KP.LEFT_ANKLE, KP.RIGHT_ANKLE];
  return keyIndices.every(i => (landmarks[i]?.visibility ?? 0) > 0.5);
}
