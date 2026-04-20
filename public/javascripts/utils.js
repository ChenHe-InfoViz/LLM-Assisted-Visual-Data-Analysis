var hisStruc = [], curMessages = [], tutorial = false, test = false, globalVersion = 'beta', globalstatus = -1

const md = window.markdownit();

const FIELD_TYPES = {
  age: 'num',
  'work.class': 'cat',
  education: 'cat',
  'education.num': 'cat',
  'marital.status': 'cat',
  occupation: 'cat',
  relationship: 'cat',
  race: 'cat',
  sex: 'cat',
  'capital.gain': 'num',
  'capital.loss': 'num',   
  'hours.per.week': 'num',
  'native.country': 'cat', 
  salary: 'cat',

  ///tutorial data (bmw):
  model: 'cat',
  year: 'num',
  price: 'num',
  transmission: 'cat',
  mileage: 'num',
  fuelType: 'cat',
  mpg: 'num',
  engineSize: 'num'
};

const ORDINAL_ORDERS = {
  education: [
    'Preschool','1st-4th','5th-6th','7th-8th','9th','10th','11th',
    '12th','HS-grad','Some-college','Assoc-voc','Assoc-acdm',
    'Bachelors','Masters','Prof-school', 'Doctorate'
  ],
  'education.num': ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
  'work.class': [
    "Federal-gov",       // Federal government employee
    "State-gov",         //State government employee
    "Local-gov",         //Local government employee
    "Private",           //Private company employee
    "Self-emp-inc",      // Self-employed, incorporated (runs a business)
    "Self-emp-not-inc",  // Self-employed, unincorporated (freelancer / sole proprietor)
    "Without-pay",       // Works without pay (e.g. family business)
    "Never-worked",      // Has never worked
  ],
  'marital.status': [
    "Never-married",          // Never married
    "Married-civ-spouse",     // Married, civilian spouse present
    "Married-AF-spouse",      // Married, Armed Forces spouse present
    "Married-spouse-absent",  // Married, but spouse not living in the household
    "Separated",              // Legally separated
    "Divorced",               // Divorced
    "Widowed"                 // Widowed
  ],
  occupation: [
    "Prof-specialty",     // Professional specialty (e.g. doctors, engineers, scientists)
    "Exec-managerial",    // Executives and managers
    "Tech-support",       // Technical support and related skilled roles
    "Sales",              // Sales and business development
    "Adm-clerical",       // Administrative and clerical staff
    "Craft-repair",       // Skilled trades and repair workers
    "Transport-moving",   // Transportation and material moving
    "Machine-op-inspct",  // Machine operators and inspectors
    "Handlers-cleaners",  // Manual laborers, handlers, janitorial staff
    "Other-service",      // General service occupations (food, personal care, etc.)
    "Priv-house-serv",    // Private household service (nannies, housekeepers)
    "Farming-fishing",    // Agricultural and fishing occupations
    "Protective-serv",    // Police, fire, and security services
    "Armed-Forces",       // Military occupations
  ],
  relationship:[
    "Husband",          // Married male head of household
    "Wife",             // Married female head of household
    "Own-child",        // Biological/adopted/step child of householder
    "Other-relative",   // Other family relation (e.g. sibling, parent, in-law)
    "Unmarried",        // Unmarried partner living with householder
    "Not-in-family"     // Living alone or non-family household member
  ],
  race: [
    "White",               // White
    "Black",               // Black or African American
    "Asian-Pac-Islander",  // Asian or Pacific Islander
    "Amer-Indian-Eskimo",  // American Indian or Alaska Native (Eskimo historically used)
    "Other"                // Other race (not specified above or mixed)
  ],
  sex: ['Male', 'Female'],
  'native.country': [
    // North America
    "United-States",              // Primary / majority group
    "Canada",                     // Neighboring country
    "Mexico",                     // Major immigration source
    "Puerto-Rico",                // U.S. territory
    "Outlying-US(Guam-USVI-etc)", // Other U.S. territories

    // Central America & Caribbean
    "Cuba",                       // Caribbean
    "Jamaica",                    // Caribbean
    "Dominican-Republic",         // Caribbean
    "Haiti",                      // Caribbean
    "Trinadad&Tobago",            // Caribbean
    "Guatemala",                  // Central America
    "Honduras",                   // Central America
    "El-Salvador",                // Central America
    "Nicaragua",                  // Central America
    "Panama",                     // (Not in your list but often included)

    // South America
    "Columbia",                   // South America
    "Ecuador",                    // South America
    "Peru",                       // South America
    "Chile",                      // (Sometimes appears)
    "Argentina",                  // (Sometimes appears)
    "Brazil",                     // (Sometimes appears)

    // Europe (Western & Eastern)
    "England",                    // Western Europe
    "Ireland",                    // Western Europe
    "Scotland",                   // Western Europe
    "France",                     // Western Europe
    "Germany",                    // Western Europe
    "Holand-Netherlands",         // Western Europe
    "Italy",                      // Southern Europe
    "Portugal",                   // Southern Europe
    "Greece",                     // Southern Europe
    "Poland",                     // Eastern Europe
    "Hungary",                    // Eastern Europe
    "Yugoslavia",                 // Former Eastern Europe / Balkans

    // Asia
    "India",                      // South Asia
    "Iran",                       // Middle East / West Asia
    "Vietnam",                    // Southeast Asia
    "Cambodia",                   // Southeast Asia
    "Thailand",                   // Southeast Asia
    "Laos",                       // Southeast Asia
    "Philippines",                // Southeast Asia
    "China",                      // East Asia
    "Taiwan",                     // East Asia
    "Hong",                       // (Hong Kong)
    "Japan",                      // East Asia

    // Catch-all / Missing
    "South",                      // Ambiguous label (likely “South America” misc.)
  ],
  salary: [ 'Below-50K', "Above-50K" ],
  model:[
    "1 Series",
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "6 Series",
    "7 Series",
    "8 Series",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
    "Z3",
    "Z4",
    "i3",
    "i8",
    "M2",
    "M3",
    "M4",
    "M5",
    "M6"
  ], transmission: ["Semi-Auto", "Automatic", "Manual" ],
  fuelType: [
    "Petrol",
    "Diesel",
    "Hybrid",
    "Electric",
    "Other"
  ]
};

// function canonical(name) {
//   return String(name).trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
// }
function nice(name) {
  return String(name).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function inferType(field, values) {
  // const key = field in FIELD_TYPES ? field : canonical(field);
  if (FIELD_TYPES[field]) return FIELD_TYPES[field];
  console.error('unknown type : ' + field)
  return 'num'
  // let nums = 0, cats = 0;
  // for (let i = 0; i < Math.min(200, values.length); i++) {
  //   const v = values[i];
  //   if (v == null || v === '') continue;
  //   if (!isNaN(+v)) nums++; else cats++;
  // }
  // return nums > cats ? 'num' : 'cat';
}

function rotateTick(d3Ele, isX = true){
  if(isX)
    d3Ele.selectAll('text')
      .attr('transform', 'rotate(-25)')
      .style('text-anchor', 'end')
      .attr('dx', '0.1em')
      .attr('dy', '0.5em')
  else
    d3Ele.selectAll('text')
      .attr('transform', 'rotate(-25)')
      .style('text-anchor', 'end')
      .attr('dx', '0.1em')
      .attr('dy', '-0.1em')
}

// function getChartLabel(chartType) {
//   const map = {
//     bar_count: 'Bar chart',
//     bar_median: 'Bar chart',
//     hist: 'Histogram',
//     heatmap_cat_cat: 'Heatmap',
//     heatmap_num_any: 'Heatmap'
//   };
//   return map[chartType] || 'Unknown chart type';
// }

function measure_width(text){
  const context = document.createElement("canvas").getContext("2d");
  return context.measureText(text).width;
}

function median(arr) {
  const a = arr.filter(v => v!=null && !isNaN(+v)).map(Number).sort((a,b)=>a-b);
  if (!a.length) return NaN;
  const mid = Math.floor(a.length/2);
  return a.length%2 ? a[mid] : (a[mid-1]+a[mid])/2;
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const d of arr) {
    const k = keyFn(d);
    const bucket = map.get(k);
    if (bucket) bucket.push(d); else map.set(k, [d]);
  }
  return map;
}

function unique(arr) { return Array.from(new Set(arr)); }

function colorScale(categories) {
  const scheme = d3.schemeTableau10 || d3.schemeCategory10;
  const cats = Array.from(categories);
  const scale = d3.scaleOrdinal().domain(cats).range(scheme.concat(scheme));
  return scale;
}

function showTooltip(text, x, y){
  $("#tipName").html(text)
  const tooltipWidth = $("#tipName")[0].offsetWidth;
  const tooltipHeight = $("#tipName")[0].offsetHeight;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const offset = 12;

  // Compute corrected positions
  let left = x;
  let top = y + offset;

  // Prevent overflow on the right side
  if (left + tooltipWidth > windowWidth) {
    left = x - tooltipWidth - offset;
  }

  // Prevent overflow on the bottom
  if (top + tooltipHeight > windowHeight) {
    top = y - tooltipHeight - offset;
  }

  $("#tooltip").css({
    left: left + "px",   
    top: top + "px",
    visibility: "visible"
  })
}

function percentify(matrix, by='row') {
  if (by === 'row') {
    const rows = d3.rollup(matrix, v => d3.sum(v, d => d.value), d => d.y);
    return matrix.map(d => ({...d, value: rows.get(d.y) ? d.value / rows.get(d.y) : 0}));
  } else if (by === 'col') {
    const cols = d3.rollup(matrix, v => d3.sum(v, d => d.value), d => d.x);
    return matrix.map(d => ({...d, value: cols.get(d.x) ? d.value / cols.get(d.x) : 0}));
  }
  return matrix;
}

function dragPill(pillEl) {
  pillEl.draggable = true;
  pillEl.addEventListener('dragstart', e => {
    pillEl.classList.add('dragging');
    e.dataTransfer.setData('text/plain', pillEl.dataset.field);
  });
  ['dragend','drop'].forEach(evt =>
    pillEl.addEventListener(evt, () => {
      pillEl.classList.remove('dragging')
    })
  );
}

function makeDropZone(el, onDrop) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('dragover');
    const field = e.dataTransfer.getData('text/plain');
    onDrop(field);
  });
}

function drawHeatmapLegend(gl, colorScale, {
  title = '',
  width = 160,
  height = 12,
  marginTop = 10,
  marginLeft = 10,
  ticks = 5,
  format = d3.format('.0%')
} = {}) {
  // Remove previous legend (if any)
  gl.selectAll("*").remove();
  gl.attr('transform', `translate(${marginLeft},${marginTop})`);

  const defs = gl.append('defs');
  const gradientId = `legend-gradient-${Math.random().toString(36).slice(2, 8)}`;

  // Create gradient stops
  const gradient = defs.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%')
    .attr('y1', '0%')
    .attr('y2', '0%');

  const domain = colorScale.domain();
  const interpolator = colorScale.interpolator ? colorScale.interpolator() : d3.interpolateBlues;
  const n = 32;
  d3.range(n).forEach((i) => {
    gradient.append('stop')
      .attr('offset', `${(i / (n - 1)) * 100}%`)
      .attr('stop-color', colorScale(domain[0] + (domain[1] - domain[0]) * (i / (n - 1))));
  });

  // Draw color bar
  gl.append('rect')
    .attr('width', width)
    .attr('height', height)
    .style('fill', `url(#${gradientId})`)
    .attr('stroke', '#ccc')
    .attr('stroke-width', 0.5);

  // Create scale for axis
  const scale = d3.scaleLinear()
    .domain(domain)
    .range([0, width]);

  const axis = d3.axisBottom(scale)
    .ticks(ticks)
    .tickFormat(format);

  gl.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(axis)
    .call(g => g.select('.domain').remove());

  // Add title
  gl.append('text')
    .attr('x', 0)
    .attr('y', -5)
    .attr('fill', '#000')
    .attr('font-weight', 'bold')
    .attr('font-size', '12px')
    .text(title);

  // return legend;
}

function addLog(obj){
  return
  // if(!obj.userId || test) return
  // obj.version = globalVersion
  // obj.status = globalstatus
  // hisStruc.push(obj)
  // if(hisStruc.length > 10 || obj.type == 'saveNote' || obj.type == 'gotoQuestionnaire')
  //   saveLog()
}

function saveLog(){
  return
  // var temp = hisStruc;
  // hisStruc = [];
  // $.ajax({
  //    url: 'users/savelog',
  //    type: 'POST',
  //    contentType:'application/json',
  //    data: JSON.stringify(temp),
  //    dataType:'json',
  //    success: function(){
  //     //console.log(res)
  //       console.log("writing log success!")
  //    },
  //    error: function()
  //    {
  //       console.log("writing log error!");
  //       hisStruc = hisStruc.concat(temp)
  //    }
  // })
}

function getTime(){
  return new Date().getTime();
}

function getFormatedTime(){
  var date = new Date().toLocaleString("en-US", {timeZone: "GMT"});
  date = new Date(date);
  return date.getFullYear() + "-" + ((date.getMonth() + 1)<10?'0':'') + (date.getMonth() + 1) + "-" + (date.getDate()<10?'0':'') + date.getDate()  + "T" + (date.getHours()<10?'0':'') + date.getHours()  + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes()  + ":" + (date.getSeconds()<10?'0':'') + date.getSeconds() + '.' + date.getMilliseconds() + 'Z'
}

function attrExp(classname = '.pill', helpclass = '.help'){
document.querySelectorAll(classname).forEach(pill => {
  // console.log(pill)
  const helpDiv = document.querySelector(helpclass);

  const workClassInfo = `
    Work.Class: <br>
    <b>Federal-gov</b>: Federal government employee.<br>
    <b>State-gov</b>: State government employee.<br>
    <b>Local-gov</b>: Local government employee.<br>
    <b>Private</b>: Private company employee.<br>
    <b>Self-emp-inc</b>: Self-employed, incorporated (runs a business).<br>
    <b>Self-emp-not-inc</b>: Self-employed, unincorporated (freelancer / sole proprietor).<br>
    <b>Without-pay</b>: Works without pay (e.g. family business).<br>
    <b>Never-worked</b>: Has never worked.
  `;

  const maritalStatusInfo = `
    Marital.Status: <br>
    <b>Never-married.</b><br>
    <b>Married-civ-spouse</b>: Married to a civilian.<br>
    <b>Married-AF-spouse</b>: Married to a member of the Armed Forces.<br>
    <b>Married-spouse-absent</b>: Married, but spouse not living in the household.<br>
    <b>Separated</b>: Legally separated.<br>
    <b>Divorced.</b><br>
    <b>Widowed.</b>
  `;

  const occupationInfo = `
    Occupation: <br>
    <b>Prof-specialty</b>: Professional specialty (e.g. doctors, engineers, scientists).<br>
    <b>Exec-managerial</b>: Executives and managers.<br>
    <b>Tech-support</b>: Technical support and related skilled roles.<br>
    <b>Sales</b>: Sales and business development.<br>
    <b>Adm-clerical</b>: Administrative and clerical staff.<br>
    <b>Craft-repair</b>: Skilled trades and repair workers.<br>
    <b>Transport-moving</b>: Transportation and material moving.<br>
    <b>Machine-op-inspct</b>: Machine operators and inspectors.<br>
    <b>Handlers-cleaners</b>: Manual laborers, handlers, janitorial staff.<br>
    <b>Other-service</b>: General service occupations (e.g., food, personal care).<br>
    <b>Priv-house-serv</b>: Private household service (e.g., nannies, housekeepers).<br>
    <b>Farming-fishing</b>: Agricultural and fishing occupations.<br>
    <b>Protective-serv</b>: Police, fire, and security services.<br>
    <b>Armed-Forces</b>: Military occupations.
  `;

  const relationshipInfo = `
    Relationship:<br>
    <b>Husband.</b><br>
    <b>Wife.</b><br>
    <b>Own-child</b>: Biological or adopted child of the householder.<br>
    <b>Other-relative</b>: Relative other than spouse or child.<br>
    <b>Unmarried</b>: Unmarried partner.<br>
    <b>Not-in-family</b>: Unrelated individual living alone or with others.
  `;

  const raceInfo = `
    Race:<br>
    <b>White</b>: White<br>
    <b>Black</b>: Black or African American.<br>
    <b>Asian-Pac-Islander</b>: Asian or Pacific Islander.<br>
    <b>Amer-Indian-Eskimo</b>: American Indian or Alaska Native.<br>
    <b>Other</b>: Other race (not specified above or mixed).
  `;

  const educationInfo = `
    Education: <br>
    <b>Preschool.</b><br>
    <b>1st–4th</b>: Elementary school, early grades.<br>
    <b>5th–6th</b>: Upper elementary.<br>
    <b>7th–8th</b>: Middle school or junior high.<br>
    <b>9th</b>: Freshman year of high school.<br>
    <b>10th</b>: Sophomore year of high school.<br>
    <b>11th</b>: Junior year of high school.<br>
    <b>12th</b>: Senior year of high school (but no diploma yet).<br>
    <b>HS-grad</b>: Finished high school.<br>
    <b>Some-college</b>: Took college classes but didn’t finish a degree.<br>
    <b>Assoc-voc</b>: Associate’s degree on vocational/technical training.<br>
    <b>Assoc-acdm</b>: Associate’s degree on academic/transfer studies.<br>
    <b>Bachelors</b>: Completed a 4-year college degree.<br>
    <b>Masters</b>: Graduate degree beyond a bachelor’s (like MA, MS, MBA).<br>
    <b>Prof-school</b>: Professional degree (law, medicine, dentistry, etc.).<br>
    <b>Doctorate.</b>`

  // Education mapping (1–16)
  const educationLabels = [
    'Preschool.','1st-4th.','5th-6th.','7th-8th.','9th.','10th.','11th.',
    '12th.','High school graduate.','Some college.','Associate’s degree on vocational/technical training.','Associate’s degree on academic/transfer studies.',
    'Bachelors.','Masters.','Professional degree (law, medicine, dentistry, etc.).','Doctorate.'
  ];
  const educationNumInfo = `Education.Num: <br/> ${educationLabels
    .map((label, i) => `${i + 1}: ${label}`)
    .join('<br>')}`;

  const capitalGainInfo = `
    Capital.Gain: <b>Income from selling capital assets (e.g. stocks, property).</b> Higher values indicate more earnings from investments.
  `;

  const capitalLossInfo = `
    Capital.Loss: <b>Losses from selling capital assets at a lower value than purchased.</b> Used to offset capital gains when computing taxable income.
  `;

  const hoursPerWeekInfo = `
    Hours.Per.Week: <b>Number of hours the person usually works per week.</b> Used to assess full-time or part-time work status.
  `;

  const salaryInfo = `Salary: <b>A binary label indicating whether an individual’s annual income is above or below $50K.</b>`

  const modelInfo = `Model: The specific variant of the car produced by BMW.`
  const yearInfo = `Year: The manufacturing year of the car.`
  const priceInfo = `Price: Market price of the car.`
  const transmissionInfo = `Transmission: The type of gearbox the car has. <br>
      <b>Manual</b>: The driver changes gears manually using a clutch. <br>
      <b>Automatic</b>: The car changes gears automatically.<br>
      <b>Semi-Auto</b>: The driver shifts gears without a clutch pedal, while the car handles the clutch and gear changes automatically.`
  const mileageInfo = `Mileage: How many miles the car has been driven.`
  const fuelTypeInfo = `FuelType: The type of fuel the car uses.`
  const mpgInfo = `Mpg: A measure of the car's fuel efficiency, indicating how many miles it can travel per gallon of fuel.`
  const engineSizeInfo = `EngineSize: The displacement (size) of the engine in litres. Larger engine size often means more power, but possibly higher running costs and lower fuel efficiency.`

  const showHelp = () => {
    const field = pill.dataset.field;
    let content = '';

    switch (field) {
      case 'work.class':
        content = workClassInfo;
        break;
      case 'education':
        content = educationInfo;
        break;
      case 'education.num':
        content = educationNumInfo;
        break;
      case 'marital.status':
        content = maritalStatusInfo;
        break;
      case 'occupation':
        content = occupationInfo;
        break;
      case 'relationship':
        content = relationshipInfo;
        break;
      case 'race':
        content = raceInfo;
        break;
      case 'capital.gain':
        content = capitalGainInfo;
        break;
      case 'capital.loss':
        content = capitalLossInfo;
        break;
      case 'hours.per.week':
        content = hoursPerWeekInfo;
        break;
      case 'salary':
        content = salaryInfo;
        break;
      case 'model':
        content = modelInfo;
        break;
      case 'year':
        content = yearInfo;
        break;
      case 'price':
        content = priceInfo;
        break;
      case 'transmission':
        content = transmissionInfo;
        break;
      case 'mileage':
        content = mileageInfo;
        break;
      case 'fuelType':
        content = fuelTypeInfo;
        break;
      case 'mpg':
        content = mpgInfo;
        break;
      case 'engineSize':
        content = engineSizeInfo;
        break;
      default:
        content = `No info available for "${field}".`;
    }

    helpDiv.innerHTML = content;
    if(classname == '.pill'){
      const obj = {type: "clickAttribute", content: content, attribute: field, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    }
  };

  pill.addEventListener('click', showHelp);
});
}

function estimatedTickMargin(labels, margin = 'bottom', angleDeg = 25, fontHeight = 10) {
  const angle = angleDeg * Math.PI / 180;
  let max = 0, projected, w

  if(margin == 'bottom')
    labels.forEach(t => {
      w = measure_width(String(t));
      projected = Math.abs(w * Math.sin(angle)) + Math.abs(fontHeight * Math.cos(angle))
      max = Math.max(max, projected);
    });
  else labels.forEach(t => {
      w = measure_width(String(t));
      projected = Math.abs(w * Math.cos(angle)) + Math.abs(fontHeight * Math.sin(angle));
      max = Math.max(max, projected);
    });

  return Math.ceil(max + 6); // + padding
}

function showText(prefix, content, ele) {
  return new Promise( resolve => {
    var index = 0, curContent = "", lastTime = Date.now(), step = 5

    streamText()
    function streamText(){
      if(index < content.length){
        const now = Date.now();
        const delta = now - lastTime;
        const steps = Math.floor(delta / 20);

        for (let i = 0; i < steps && index < content.length; i++) {
          step = Math.floor(Math.random() * 2) + 1;
          curContent += content.substr(index, step);
          index += step;
        }
        ele.html(md.render(prefix + curContent))
        lastTime = now
        const delay = Math.random() * 40 + 20; // between 20ms–60ms
        setTimeout(streamText, delay); // Adjust speed by changing the timeout value
        // $('#messageDiv').animate({ scrollTop: $('#innerMessageDiv').height() }, 100);

      }else resolve()
    }
  })
}

function isDark(color) {
  const c = d3.color(color);
  // relative luminance (WCAG-style)
  const luminance = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return luminance < 0.5;
}

