var express = require('express');
var router = express.Router();
const path = require('path');

const OpenAI = require("openai");
require('dotenv').config({path: path.join(__dirname, ".env")})
const {pipeline} = require("stream");
const {PassThrough} = require("stream");
const mongoose = require('mongoose');

router.get('/', function(req, res, next) {
  res.sendFile('index.html', { root: path.join(__dirname, '../public/javascripts') });
});

router.get("/tutorial", function(req, res, next) {
  res.sendFile('tutorialindex.html', { root: path.join(__dirname, '../public/javascripts') });
});

const model = "gpt-5.1"
const attrSubsets = ['age', 'sex', 'salary (Below-50K or Above-50K)', 'capital-gain', 'capital-loss', 
  'education', 'education-num', 'hours-per-week', 'occupation', 'work-class', 'marital-status', 'relationship', 'race', 'native-country']
const systemPromptInit = "You are a data analysis tutor helping a user analyze and reason about patterns in a 1000-sample subset of the 1994 U.S. Census 'Adult' dataset. You do not have direct access to the data; instead, you guide the user to explore the data and help interpret and contextualize the findings. " + 
`The dataset includes the following attributes: `
//"You are an assistant who helps the user analyze and reason about findings derived from a 1000-sample subset of the BMW dataset. You do not have direct access to the data; instead, you deliberate on the findings the user reports. " + 
//"The dataset includes the following attributes: Model, Year, Price, Transmission, Mileage, FuelType, Mpg, and EngineSize. Numerical attributes are Year, Price, Mileage, Mpg, and EngineSize. All others are categorical. " + 
const systemPromptInstr = ". The user can analyze the data through four linked slots, each with x- and y-axes, where they can drag and drop attributes to create the corresponding charts. " + 
"* A categorical attribute on the x-axis of a slot: a bar chart shows category counts. The user can click on the bars to select/deselect data. " + 
"* A categorical attribute on the x-axis and a numerical attribute on the y-axis of a slot: a chart shows the median numerical value per category. The user can click on the median dash to select the data subset. " + 
"* A numerical attribute on the x-axis of a slot: a histogram shows the distribution of the numerical values. The user can brush the bins to select the data subset. " + 
"* Two categorical attributes on the x and y axes of a slot: a heatmap. The user can brush to select the cells. " + 
"* A numerical attribute on the x-axis and a categorical attribute on the y-axis of a slot: a heatmap with the numerical value binned into 9 groups. The user can brush to select the cells. " + 
"* In heatmaps, the user can choose to show 1) counts, 2) percentages by row, or 3) percentages by column in the cells. " + 
"* Two numerical attributes on the x and y axes of a slot: a scatterplot. The user can brush to select data points. " + 
"* All four slots are linked: the data selection from multiple slots builds an AND relation to highlight how the selected data compares with the full dataset in the background. " + 
"For instance, if the user selects a bar in the bar chart, the corresponding data will be highlighted in other views." + 
"* In the heatmap, larger red cells mean a higher proportion of selected instances in that cell, while darker red cells indicate higher numbers of selected instances in that cell compared to other cells, as shown by the legend. " + 
"Your goals: " + 
"1. Help the user think like a data analyst. For instance, encourage starting with a high-level overview of the dataset; " +
"emphasize exploring with a clear question or goal in mind; and promote good analysis practices, including checking distributions, comparing groups, considering confounders, and iteratively refining selections." + 
"2. Keep answers concise and clear: no more than 3–4 sentences, using simple and non-technical language. " +  
"3. Provide interpretation and context using general knowledge of 1990s US demographics, labor markets, education, and economics, while avoiding causal claims. " + 
"4. Point out limitations or alternative explanations (e.g., confounding factors, dataset design, biases). " + 
"5. Suggest a practical next step based on the user’s task and available interface features, briefly explain its usefulness, and maintain a big-picture perspective to support systematic, structured exploration." + 
"6. **Do not repeat or recreate the chart the user has already produced to make the discovery**. " + 
"7. If the user’s description of their analysis is unclear, ask for clarification about what they have explored or selected so far."


router.post("/chatapi", async (req, res) => {
  try{
    const messages = req.body.messages
    messages.unshift({role: "system", content: systemPromptInit + attrSubsets.join(',') + systemPromptInstr})

    console.log(req.body.messages)
    const response = await fetch("https://api.openai.com/v1/chat/completions",{
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      // We need to send the body as a string, so we use JSON.stringify.
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
        verbosity: 'low'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return res.status(500).json({ error: "OpenAI API error", details: error });
    }

    const data = await response.json(); // Parse JSON response
    console.log("OpenAI API response:", data);

    return res.json({
      success: true,
      data: data,
    });
    // if (!response.ok) {
    //   const errorText = await response.text();
    //   console.error("OpenAI API error:", errorText);
    //   return res.status(response.status).send(errorText);
    // }

    // // Prepare the response to stream data to the client
    // res.setHeader("Content-Type", "text/event-stream");
    // res.setHeader("Cache-Control", "no-cache");
    // res.setHeader("Connection", "keep-alive");

    // const passThrough = new PassThrough();
    // pipeline(response.body, passThrough, (err) => {
    //   if (err) console.error("Pipeline failed:", err);
    // });

    // Stream the raw bytes from OpenAI to the browser
    // passThrough.pipe(res);
  } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
  }
})

module.exports = router;
