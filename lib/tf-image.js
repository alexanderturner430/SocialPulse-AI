/**
 * TensorFlow.js Image Analysis Tools
 * Image classification, object detection, segmentation, face/pose analysis
 */

const tf = require("@tensorflow/tfjs-node");

const modelCache = {};

async function loadModel(name, loader) {
  if (!modelCache[name]) {
    console.log(`[tf-image] Loading model: ${name}...`);
    modelCache[name] = await loader();
    console.log(`[tf-image] Model loaded: ${name}`);
  }
  return modelCache[name];
}

async function loadImage(input) {
  if (Buffer.isBuffer(input)) {
    return tf.node.decodeImage(input);
  }
  if (typeof input === "string" && input.startsWith("data:")) {
    const base64 = input.split(",")[1];
    return tf.node.decodeImage(Buffer.from(base64, "base64"));
  }
  if (typeof input === "string") {
    const response = await fetch(input);
    const buffer = Buffer.from(await response.arrayBuffer());
    return tf.node.decodeImage(buffer);
  }
  throw new Error("Invalid image input: provide URL, base64, or Buffer");
}

async function classifyImage(imageInput) {
  const mobilenet = require("@tensorflow-models/mobilenet");
  const model = await loadModel("mobilenet", () => mobilenet.load());
  const image = await loadImage(imageInput);
  const predictions = await model.classify(image);
  image.dispose();
  return predictions.map(p => ({ className: p.className, probability: p.probability }));
}

async function detectObjects(imageInput) {
  const cocoSsd = require("@tensorflow-models/coco-ssd");
  const model = await loadModel("coco-ssd", () => cocoSsd.load());
  const image = await loadImage(imageInput);
  const predictions = await model.detect(image);
  image.dispose();
  return predictions.map(p => ({
    class: p.class,
    score: p.score,
    bbox: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] }
  }));
}

async function segmentImage(imageInput) {
  let deeplab;
  try {
    deeplab = require("@tensorflow-models/deeplab");
  } catch (e) {
    return { error: "DeepLab model not available (peer dependency conflict with tfjs v4)" };
  }
  const model = await loadModel("deeplab", () => deeplab.load({ base: "pascal" }));
  const image = await loadImage(imageInput);
  const segmentation = await model.segment(image);
  image.dispose();
  return {
    legend: segmentation.legend,
    width: segmentation.segmentationMap.width,
    height: segmentation.segmentationMap.height
  };
}

async function detectFaces(imageInput) {
  const faceapi = require("@vladmandic/face-api");
  const modelLoaded = modelCache["face-api-loaded"];
  if (!modelLoaded) {
    const MODEL_DIR = require("path").join(__dirname, "..", "node_modules", "@vladmandic", "face-api", "model");
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    await faceapi.nets.ageGenderNet.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_DIR);
    modelCache["face-api-loaded"] = true;
  }
  const buffer = Buffer.isBuffer(imageInput) ? imageInput :
    typeof imageInput === "string" && imageInput.startsWith("data:")
      ? Buffer.from(imageInput.split(",")[1], "base64")
      : await fetch(imageInput).then(r => Buffer.from(r.arrayBuffer()));
  const { Canvas, Image } = require("canvas");
  const img = new Image();
  img.src = buffer;
  const canvas = new Canvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const detections = await faceapi
    .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options())
    .withAgeAndGender()
    .withFaceExpressions();
  return detections.map(d => ({
    detection: { score: d.detection.score, box: d.detection.box },
    age: d.age,
    gender: d.gender,
    genderProbability: d.genderProbability,
    expressions: d.expressions
  }));
}

async function detectPose(imageInput) {
  const poseDetection = require("@tensorflow-models/pose-detection");
  const model = await loadModel("posenet", () => poseDetection.createDetector(
    poseDetection.SupportedModels.PoseNet,
    { quantBytes: 2, architecture: "MobileNetV1", outputStride: 16, multiplier: 0.75 }
  ));
  const image = await loadImage(imageInput);
  const poses = await model.estimatePoses(image);
  image.dispose();
  return poses.map(p => ({
    keypoints: p.keypoints.map(kp => ({ name: kp.name, score: kp.score, x: kp.x, y: kp.y }))
  }));
}

async function segmentPerson(imageInput) {
  const bodySegmentation = require("@tensorflow-models/body-segmentation");
  const model = await loadModel("body-seg", () => bodySegmentation.createSegmenter(
    bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
    { runtime: "tfjs" }
  ));
  const image = await loadImage(imageInput);
  const segmentation = await model.segmentPeople(image);
  image.dispose();
  return {
    width: segmentation[0]?.mask?.shape[1] || 0,
    height: segmentation[0]?.mask?.shape[0] || 0,
    personCount: segmentation.length
  };
}

async function analyzeThumbnail(imageInput) {
  const classifications = await classifyImage(imageInput);
  const objects = await detectObjects(imageInput);
  const faceCount = (await detectFaces(imageInput)).length;
  const dominantObjects = objects.slice(0, 5).map(o => o.class);
  const hasText = dominantObjects.some(o => ["book", "laptop", "cell phone", "tv"].includes(o));
  return {
    classifications: classifications.slice(0, 5),
    faceCount,
    hasText,
    dominantObjects,
    visualComplexity: objects.length,
    effectivenessScore: Math.min(100, Math.round(
      (faceCount * 20) + (objects.length * 5) + (classifications[0]?.probability * 30 || 0)
    ))
  };
}

async function compareImages(imageInput1, imageInput2) {
  const mobilenet = require("@tensorflow-models/mobilenet");
  const model = await loadModel("mobilenet", () => mobilenet.load());
  const img1 = await loadImage(imageInput1);
  const img2 = await loadImage(imageInput2);
  const embedding1 = model.infer(img1, true).squeeze();
  const embedding2 = model.infer(img2, true).squeeze();
  img1.dispose();
  img2.dispose();
  const similarity = tf.losses.cosineDistance(embedding1, embedding2, 0).dataSync()[0];
  embedding1.dispose();
  embedding2.dispose();
  return { similarity: 1 - similarity, isSimilar: similarity < 0.3 };
}

module.exports = {
  classifyImage,
  detectObjects,
  segmentImage,
  detectFaces,
  detectPose,
  segmentPerson,
  analyzeThumbnail,
  compareImages
};