const express = require("express");
const path = require("path");
const { getLambdaFunctions, clearCache } = require("./services/lambdaService");

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// main route.
app.get("/", async (req, res) => {
  const region = req.query.region || "ap-south-1";
  const functions = await getLambdaFunctions(region);

  res.render("index", {
    functions,
    selectedRegion: region,
    basePath: process.env.BASE_PATH || "",
  });
});

app.get("/refresh", async (req, res) => {
  clearCache();

  const region = req.query.region || "ap-south-1";

  await getLambdaFunctions(region, true);

  res.redirect(`${process.env.BASE_PATH || ""}/?region=${region}`);
});

module.exports = app;
