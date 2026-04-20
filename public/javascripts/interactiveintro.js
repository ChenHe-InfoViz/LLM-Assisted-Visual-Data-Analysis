 function startIntro(){
    var intro = introJs.tour();
    var introSteps = [
        {
            element: "main",
            intro: 'This tool lets you explore datasets using <b>histograms</b>, <b>bar charts</b>, <b>scatterplots</b> and <b>heatmaps</b>. The sample dataset features information about BMW cars.',
            // position: "right",
        },
        {
            element: "#fieldsPanel",
            intro: 'The left panel lists all available attributes alphabetically, either categorical (<span style="color: rgba(0,0,0,.6);">abc</span>) or numerical (<span style="color: rgba(0,0,0,.6);">123</span>). Clicking any attribute reveals a detailed explanation.',
            // position: "right",
        },
        {
            element: "#fieldsPanel",
            intro: 'Please click on the <b>Mpg <span style="color: rgba(0,0,0,.6);">123</span></b> attribute to view its description.',
            // position: "right",
        },
        {
            element: "main",
            intro: 'There are four slots available. You can <b>drag and drop</b> data attributes from the left panel onto the x- and y-axes of each slot to create charts.',
        },
        {
            element: "main",
            intro: 'Please drag and drop <b>FuelType</b> onto the x-axis of a slot: The bar chart will display the number of cars for each fuel type.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'Please drag and drop <b>Year</b> onto the x-axis of another slot: The histogram will display the manufacturing year of the cars.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'Please drag and drop <b>Price</b> onto the x-axis and <b>Mpg</b> onto the y-axis of a third slot: The scatterplot will show the correlation between Price and Mpg.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'Please drag and drop <b>Mileage</b> onto the x-axis and <b>Transmission</b> onto the y-axis of the last available slot: The heatmap will show the relation between the two variables.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'The charts are linked. Please click the <b>Diesel</b> bar in the <b>bar chart</b> to see how those cars are distributed in the other charts.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'Please click and drag across the histogram to select the <b>bins before year 2014</b> in the <b>year histogram</b>. You can clear the selection by clicking anywhere on the chart.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'From the scatterplot, you can see that <b>Diesel</b> cars manufactured before <b>2014</b> tend to be <b>less expensive</b>.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'In the heatmap, <b><span style="color: #af2e23;">red cells</span></b> and <b>overlaid numbers</b> represent the selected instances, while the <b><span style="color: #3463a6;">blue background cells</span></b> illustrate the full sample dataset.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'A <b>larger</b> red cell in the heatmap means <b>a higher proportion of selected instances within that cell</b>. The <b><span style="color: #af2e23;">color intensity</span></b> encodes the count or percentage of selected instances relative to other cells, as shown by the legend.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'The heatmap supports aggregation by <b>count</b>, <b>percentage by row</b>, or <b>percentage by column</b>. Please select <b>percentage by column</b>.',
            tooltipClass: "bottom-right-intro",
        },
        {
            element: "main",
            intro: 'From the heatmap, you can see that <b>Diesel</b> cars manufactured before <b>2014</b> tend to feature <b>manual transmissions</b>.',
            tooltipClass: "bottom-right-intro",
        },
        
        {
            element: "#chatbar",
            intro: 'Here, you can discuss your data discoveries with the ChatBot.',
            // position: "bottom-right-aligned"
        },
        {
            element: "main",
            intro: "Congratulations! You’ve completed the tutorial. You can now <b>start exploring the tool</b> by clicking <b>Done</b>."
        },
    ]
    // console.log(introSteps.length) //18
    intro.addSteps(introSteps)

    intro.setOptions({
      exitOnOverlayClick: false,
      // exitOnEsc: false,
      'doneLabel': 'Done'
    })
    intro.oncomplete(function() {
        window.location.href = "../vis/";
    });
    // $('.introjs-skipbutton').hide();
    // $('.introjs-bullets').hide();
    // $(".introjs-helperNumberLayer").hide()
    $('.introjs-progress').css("display", "block")
    intro.start()
}
