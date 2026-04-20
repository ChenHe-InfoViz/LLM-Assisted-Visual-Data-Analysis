const state = {
  data: [],
  fields: [],
  types: {},
  slots: []  // { x, y, xOuter, yOuter, percentageMode, percentBy }
};

const selectionBus = {
  local: new Map(),   // slotIndex -> Set of __id__ selected in that view
  listeners: new Map(), // slotIndex -> callback(globalSet)
  // Compute global selection as AND of all non-empty local selections
  computeGlobal() {
    const sets = Array.from(this.local.values()).filter(s => s.size > 0);
    if (sets.length === 0) return new Set();
    return sets.reduce((a, b) => new Set([...a].filter(x => b.has(x))));
  },

  // Broadcast to all charts
  broadcast() {
    const globalSel = this.computeGlobal();
    for (const cb of this.listeners.values()) cb(globalSel);
  },

  subscribe(slotIndex, cb) { this.listeners.set(slotIndex, cb); },
  // clearSubscription(slotIndex) { this.listeners.delete(slotIndex); },

  // Replace or update local selection for one view
  setLocal(slotIndex, ids) {
    this.local.set(slotIndex, new Set(ids));
    this.broadcast();
  },

  clearLocal(slotIndex) {
    this.local.delete(slotIndex);
    this.broadcast();
  },

  getLocal(slotIndex) {
    return this.local.get(slotIndex) || new Set();
  },

  getGlobal() { return this.computeGlobal(); },

  hasAnySelection() {
    // true if any slot has a non-empty selection
    return Array.from(this.local.values()).some(s => s.size > 0);
  },

  isGlobalEmpty() {
    // true if global intersection is empty, but some slots selected
    return this.hasAnySelection() && this.computeGlobal().size === 0;
  }
};

const DEFAULT_HEATMAP_BINS = 9;

// document.addEventListener('DOMContentLoaded', init);

function init() {
  // Build four slots
  const grid = document.getElementById('grid');
  for (let i = 0; i < 4; i++) {
    const slotEl = grid.querySelector(`.slot[data-slot="${i}"]`);
    buildSlot(slotEl, i);
    state.slots[i] = { x:null, y:null, xOuter:null, yOuter:null, percentageMode:'count', percentBy:'row', width: $(slotEl).width()-2, height: $(slotEl).height() - $(slotEl).children('.dropzones').outerHeight(true) - 10};
  }
  // refreshFieldList();
}

function loadData(data) {
  state.data = data.map((d, i) => ({ __id__: d.__id__ ?? i, ...d }));
  const fields = Object.keys(state.data[0] || {}).filter(k => k !== '__id__').sort((a, b) => a.localeCompare(b));
  state.fields = fields;
  state.types = {};
  for (const f of fields) state.types[f] = inferType(f, state.data.map(d => d[f]));

  // refreshFieldList();
}

function refreshFieldList() {
  const list = document.getElementById('fieldList');
  list.innerHTML = '';
  let fields = state.fields
  for (const f of fields){
    const pill = document.createElement('div');
    pill.className = `pill ${state.types[f]==='num'?'num':'cat'}`;
    pill.textContent = nice(f);
    pill.dataset.field = f;
    dragPill(pill);
    list.appendChild(pill);
  }
  attrExp()
  $('#fieldsPanel .help').height($('#fieldsPanel').height() - $('#fieldsPanel h2').outerHeight(true) - $('#fieldsPanel #fieldList').outerHeight(true))
}

function buildSlot(slotEl, i) {
  slotEl.innerHTML = '';
  // const header = document.createElement('div');
  // header.className = 'header';
  // const title = document.createElement('div');
  // title.className = 'title';
  // title.textContent = `Chart ${i+1}`;
  // header.appendChild(title);

  const opts = document.createElement('div');
  opts.className = 'opts';
  opts.style.gridColumn = 'span 2';
  opts.style.display = 'none'
  opts.innerHTML = `
    <span class="label">Aggregation:</span>
    <label><input type="radio" name="hm_${i}" value="count" checked> Count</label>
    <label><input type="radio" name="hm_${i}" value="percent_row"> % by row</label>
    <label><input type="radio" name="hm_${i}" value="percent_col"> % by column</label>
  `;

  const dropzones = document.createElement('div');
  dropzones.className = 'dropzones';
  dropzones.innerHTML = `
    <div class="drop" data-role="x"><span class="label">X:</span> <div class="val" data-placeholder="Drop attribute"></div> <span class="clear">✕</span></div>
    <div class="drop" data-role="y"><span class="label">Y:</span> <div class="val" data-placeholder="Drop attribute"></div> <span class="clear">✕</span></div>
    <!-- <div class="drop" data-role="xOuter"><span class="label">Outer X</span> <div class="val"></div> <span class="clear">✕</span></div>
    <div class="drop" data-role="yOuter"><span class="label">Outer Y</span> <div class="val"></div> <span class="clear">✕</span></div> -->
  `;

  dropzones.appendChild(opts);

  const canvas = document.createElement('div');
  canvas.className = 'canvas';
  const svg = d3.select(canvas).append('svg');

  const legend = document.createElement('div');
  legend.className = 'legend';

  slotEl.append(dropzones, canvas, legend);

  opts.querySelectorAll(`input[name="hm_${i}"]`).forEach(r => {
    r.addEventListener('change', e => {
      const v = e.target.value;
      state.slots[i].percentageMode = v === 'count' ? 'count' : 'percent';
      state.slots[i].percentBy = v === 'percent_row' ? 'row' : (v === 'percent_col' ? 'col' : state.slots[i].percentBy);
      const obj = {type: "changeAggregation", slot: i, percentageMode: state.slots[i].percentageMode, percentBy: state.slots[i].percentBy, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
      renderSlot(slotEl, i, false);
    });
  });

  dropzones.querySelectorAll('.drop').forEach(drop => {
    makeDropZone(drop, (field) => {
      const role = drop.dataset.role;
      setSlotField(i, role, field);
      const obj = {type: "drop", attribute: field, axis: role, slot: i, chart: state.slots[i].chartType, x: state.slots[i].x, y: state.slots[i].y, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    });
    drop.querySelector('.clear').addEventListener('click', () => {
      const role = drop.dataset.role;
      setSlotField(i, role, null);
      const obj = {type: "clearDrop", slot: i, axis: role, chart: state.slots[i].chartType, x: state.slots[i].x, y: state.slots[i].y, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    });
  });
}

function initSlots(){
  // console.log(state)
  let slotEl, zone, input
  for(let i = 0; i < 4; i++){
    slotEl = document.querySelector(`.slot[data-slot="${i}"]`);
    zone = slotEl.querySelector(`.drop[data-role="x"] .val`);
    zone.innerHTML = state.slots[i].x ? `<span class="pill">${state.slots[i].x}</span>` : '';
    zone = slotEl.querySelector(`.drop[data-role="y"] .val`);
    zone.innerHTML = state.slots[i].y ? `<span class="pill">${state.slots[i].y}</span>` : '';
    if(state.slots[i].percentageMode != 'count'){
      input = state.slots[i].percentBy == 'row'? $(`input[name="hm_${i}"][value="percent_row"]`): $(`input[name="hm_${i}"][value="percent_col"]`)
      input[0].checked = true;
    }

    renderSlot(document.querySelector(`.slot[data-slot="${i}"]`), i, false)
  }

}

function setSlotField(i, role, field) {
  state.slots[i][role] = field;
  const slotEl = document.querySelector(`.slot[data-slot="${i}"]`);
  const zone = slotEl.querySelector(`.drop[data-role="${role}"] .val`);
  zone.innerHTML = field ? `<span class="pill">${field}</span>` : '';
  renderSlot(slotEl, i);
}

function decideChart(slot) {

  const { x, y } = slot;
  if (!x) return null;
  const xType = state.types[x];
  const yType = y ? state.types[y] : null;

  if (xType === 'cat' && (!y || yType === 'cat')) {
    if (!y) return 'bar_count';
    return 'heatmap_cat_cat';
  }
  if (xType === 'cat' && yType === 'num') return 'bar_median';
  if (xType === 'num' && !y) return 'hist';
  if (xType === 'num' && yType === 'cat') return 'heatmap_num_any';
  if (xType === 'num' && yType === 'num') return 'scatter';
  return null;
}

function renderSlot(slotEl, i, clear = true) {
  if(clear) selectionBus.clearLocal(i);

  const slot = state.slots[i];
  const chartType = decideChart(slot);
  slot.chartType = chartType
  const svg = d3.select(slotEl).select('svg');
  const legend = d3.select(slotEl).select('.legend');

  svg.selectAll('*').remove();
  // overlay.selectAll('*').remove();
  // selectionLayer.selectAll('*').remove();
  legend.selectAll('*').remove();

  // const { width, height } = slotEl.getBoundingClientRect();
  const width = slot.width, height = slot.height

  svg.attr('width', slot.width).attr('height', slot.height);
  // console.log(chartType, state.data.length)
  // slotEl.querySelector('.title').textContent = `Chart ${i+1}${chartType ? ' — ' + getChartLabel(chartType) : ''}`;
  if (!chartType || !state.data.length){
    d3.select(slotEl).select('.opts').style('display', 'none');
    return;
  }

  const drawFns = {
    bar_count: drawBarCount,
    bar_median: drawBarMedian,
    hist: drawHistogram,
    heatmap_cat_cat: drawHeatmapCatCat,
    heatmap_num_any: drawHeatmapNumAny,
    scatter: drawScatter
  };
  const api = drawFns[chartType](slotEl, i, width, height);
  selectionBus.subscribe(i, (sel) => { api.drawLinkedOverlay(sel); });
  api.drawLinkedOverlay(selectionBus.getGlobal());
}

// ---------- Shared helpers ----------
function baseAxes(svg, width, height, m = {}) {
  // console.log(width, height)
  const defaultMargins = { top: 8, right: 4, bottom: 60, left: 80 };
  const margins = { ...defaultMargins, ...m };
  const innerW = Math.max(100, width - margins.left - margins.right);
  const innerH = Math.max(100, height - margins.top - margins.bottom);
  // const g = svg.select('.plot').append('g').attr('transform', `translate(${margins.left},${margins.top})`);
  const group = svg.append('g')//.attr('transform', `translate(${margins.left},${margins.top})`);
  const gx = group.append('g').attr('class', 'x-axis').attr('transform', `translate(${margins.left},${innerH + margins.top})`);
  const gy = group.append('g').attr('class', 'y-axis').attr('transform', `translate(${margins.left},${margins.top})`);
  const g = group.append('g').attr('class', 'dataChart').attr('transform', `translate(${margins.left},${margins.top})`);
  // const go = svg.select('.overlay-layer').append('g').attr('transform', `translate(${margins.left},${margins.top})`);
  const gs = group.append('g').attr('class', 'selection-layer').attr('transform', `translate(${margins.left},${margins.top})`);
  const gt = group.append('g').attr('class', 'text-layer').attr('transform', `translate(${margins.left},${margins.top})`);
  const go = group.append('g').attr('class', 'brush').attr('transform', `translate(${margins.left},${margins.top})`);
  const gl = group.append('g').attr('class', 'legend').attr('transform', `translate(10,${innerH + margins.top})`);


    // Axis label groups
  const xLabel = group.append('text')
    .attr('class', 'x-label')
    .attr('x', width / 2)
    .attr('y', height - 10)

  const yLabel = group.append('text')
    .attr('class', 'y-label')
    .attr('x', -height / 2)
    .attr('y', 13)
    .attr('transform', `rotate(-90)`)
  return { g, gx, gy, go, gs, gt, gl, innerW, innerH, xLabel, yLabel, margins };
}

function addLegend(legendSel, scale, title='Segment') {
  const cats = scale.domain();
  const items = legendSel.selectAll('span.item').data(cats, d=>d);
  const enter = items.enter().append('span').attr('class','item badge');
  enter.merge(items).text(d => `${title}: ${d}`).style('border-color', (_,i)=>scale(cats[i])).style('background','transparent');
  items.exit().remove();
}

// ---------- BAR: X categorical (count) ----------
function drawBarCount(slotEl, i, width, height) {
  const { x, xOuter } = state.slots[i];
  const svg = d3.select(slotEl).select('svg');
  d3.select(slotEl).select(".opts").style('display', 'none')
  const bottom = estimatedTickMargin(ORDINAL_ORDERS[x]) + 20;
  // console.log(bottom)
  const { g, gx, gy, go, gs, gl, innerW, innerH, xLabel, yLabel} = baseAxes(svg, width, height, {left: 40, bottom: bottom});

  const groups = groupBy(state.data, d => d[x] ?? '(missing)');
  let cats = Array.from(groups.keys());
  cats = ORDINAL_ORDERS[x].filter(c => cats.indexOf(c) > -1)
  const baseScale = d3.scaleBand().domain(cats).range([0, innerW]).padding(0.1);
  const segments = xOuter ? unique(state.data.map(d => d[xOuter] ?? '(missing)')) : ['__all__'];
  const col = xOuter ? colorScale(segments) : d3.scaleOrdinal().domain(['__all__']).range(['#74add1']);
  const bandInner = xOuter ? d3.scaleBand().domain(segments).range([0, baseScale.bandwidth()]).padding(0.05) : null;

  const dataWide = cats.map(cx => {
    const safeCx = cx.replace(/<=/g, '__').replace(/[> ()]/g, '_');
    const base = groups.get(cx) || [];
    if (!xOuter) return [{ key:`${safeCx}__all`, x: cx, seg: '__all__', ids: base.map(d=>d.__id__), value: base.length }];
    const bySeg = groupBy(base, d => d[xOuter] ?? '(missing)');
    return segments.map(s => {
      const arr = (bySeg.get(s) || []);
      return { key:`${safeCx}__${s}`, x: cx, seg: s, ids: arr.map(d=>d.__id__), value: arr.length };
    });
  }).flat();

  const yScale = d3.scaleLinear().domain([0, d3.max(dataWide, d => d.value)||1]).nice().range([innerH, 0]);
  gy.call(d3.axisLeft(yScale).ticks(5));
  rotateTick(gx.call(d3.axisBottom(baseScale)))
  xLabel.text(x)
  yLabel.text('count')

  const bars = g.selectAll('rect.bar').data(dataWide, d => d.key).join('rect')
    .attr('class','bar').attr('id', d => d.key)
    .attr('x', d => baseScale(d.x) + (xOuter ? bandInner(d.seg) : 0))
    // .attr('y', d => yScale(d.value))
    .attr('width', xOuter ? bandInner.bandwidth() : baseScale.bandwidth())
    .attr('height', d => {
          let h = innerH - yScale(d.value)
          // console.log(y)
          if(h && h < 5) return 5
          return innerH - yScale(d.value)
        }).attr('y', d => {
          let h = innerH - yScale(d.value)
          // console.log(y)
          if(h && h < 5) return innerH - 5
          return yScale(d.value)
        })
    .attr('fill', d => col(d.seg))

  if (xOuter) addLegend(d3.select(slotEl).select('.legend'), col, nice(state.slots[i].xOuter));

  const IdsSetLocal = selectionBus.getLocal(i)
  if(IdsSetLocal)
    bars.each(function(d){
      if(d.ids.some(id => IdsSetLocal.has(id))) $(this).addClass('selected')
    })

  // Interaction: click toggles within this chart; global selection = union of clicked bars
  const localSel = new Set();
  bars.on('click', function(_, d){
    const k = d.key;
    if (localSel.has(k)){
      localSel.delete(k); 
      $(this).removeClass('selected')
      const obj = {type: "deselectBar", x: x, value: d.value, slot: i, dx: d.x, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    }else{ 
      localSel.add(k);
      $(this).addClass('selected')
      const obj = {type: "selectBar", x: x, value: d.value, slot: i, dx: d.x, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    }
    const ids = dataWide.filter(b => localSel.has(b.key)).flatMap(b => b.ids);
    if (ids.length === 0)
      selectionBus.clearLocal(i);  // removes this view’s constraint
    else {
      selectionBus.setLocal(i, ids);
    }
    hoverBegin = 0
  }).on('mouseenter', (event, d) => {
    let tip = `There are ${d.value} ${tutorial ? 'instances' : 'individuals'} with the <b>${d.x}</b> ${x}`
    if(selectionBus.hasAnySelection()) {
      const selRect = gs.select(`#sel_${d.key}`)
      if(!selRect.empty()){
        const c = selRect.datum().selCount
        if(c < 2) tip += `, of ${tutorial ? 'which' : 'whom'} ${c} is selected`;
        else tip += `, of ${tutorial ? 'which' : 'whom'} ${c} are selected`;
      }
    }
    showTooltip(tip + '.', event.pageX, event.pageY);
    hoverBegin = getTime()
  }).on('mouseleave', (event, d) => {
    $("#tooltip").css('visibility', "hidden")
    if(hoverBegin && getTime() - hoverBegin > 2000){
      const obj = {type: "hoverBar", x: x, slot: i, value: d.value, selValue: 'none', dx: d.x, time: getFormatedTime(), userId: curUser.id}
      if(selectionBus.hasAnySelection()) {
        const selRect = gs.select(`#sel_${d.key}`)
        obj.selValue = selRect.datum().selCount
      }
      addLog(obj)
    }
    hoverBegin = 0
  })

  function drawLinkedOverlay(sel) {
    const idSet = sel;
    const overlayData = dataWide.map(b => ({...b, selCount: b.ids.filter(id => idSet.has(id)).length}))//.filter(b => b.selCount > 0);
    // const ySel = d3.scaleLinear().domain([0, d3.max(overlayData, d => d.selCount)||1]).nice().range([innerH, 0]);
    const colSel = xOuter ? colorScale(segments) : d3.scaleOrdinal().domain(['__all__']).range(['#FA2A55']);
    const layer = gs.selectAll('rect.sel').data(overlayData, d=>`sel_${d.key}`);
    layer.join(
      enter => enter.append('rect').attr('class','sel').attr('id', d => `sel_${d.key}`)
        .attr('x', d => baseScale(d.x) + (xOuter ? bandInner(d.seg) : 0))
        .attr('y', innerH)  // start at the baseline (bottom)
        .attr('height', 0)  // start with zero height
        .attr('width', xOuter ? bandInner.bandwidth() : baseScale.bandwidth())
        .attr('fill', d => colSel(d.seg))
        .attr('opacity', 0.55)
        .transition().duration(1000).attr('height', d => {
          let h = innerH - yScale(d.selCount)
          // console.log(y)
          if(h && h < 5) return 5
          return innerH - yScale(d.selCount)
        }).attr('y', d => {
          let h = innerH - yScale(d.selCount)
          // console.log(y)
          if(h && h < 5) return innerH - 5
          return yScale(d.selCount)
        }),     // grow height
      update => update.transition().duration(1000).attr('height', d => {
          let h = innerH - yScale(d.selCount)
          // console.log(y)
          if(h && h < 5) return 5
          return innerH - yScale(d.selCount)
        }).attr('y', d => {
          let h = innerH - yScale(d.selCount)
          // console.log(y)
          if(h && h < 5) return innerH - 5
          return yScale(d.selCount)
        }),
      exit => exit.remove()
    );
  
  }

  return { drawLinkedOverlay };
}

// ---------- BAR: X categorical, Y numeric (median) ----------
function drawBarMedian(slotEl, i, width, height) {
  const { x, y, xOuter } = state.slots[i];
  const svg = d3.select(slotEl).select('svg');
  d3.select(slotEl).select(".opts").style('display', 'none')
  const bottom = estimatedTickMargin(ORDINAL_ORDERS[x]) + 20;
  const { g, gx, gy, go, gs, gl, innerW, innerH, xLabel, yLabel } = baseAxes(svg, width, height, {left: 40, bottom: bottom});

  let cats = unique(state.data.map(d => d[x] ?? '(missing)'));
  cats = ORDINAL_ORDERS[x].filter(c => cats.indexOf(c) > -1)
  const baseScale = d3.scaleBand().domain(cats).range([0, innerW]).padding(0.1);
  const segments = xOuter ? unique(state.data.map(d => d[xOuter] ?? '(missing)')) : ['__all__'];
  const col = xOuter ? colorScale(segments) : d3.scaleOrdinal().domain(['__all__']).range(['#74add1']);
  const bandInner = xOuter ? d3.scaleBand().domain(segments).range([0, baseScale.bandwidth()]).padding(0.05) : null;

  const grouped = d3.rollups(state.data, v => v, d => d[x] ?? '(missing)', d => xOuter ? (d[xOuter] ?? '(missing)') : '__all__');
  const map = new Map(grouped.map(([cx, arr]) => [cx, new Map(arr)]));
  const barsData = cats.flatMap(cx => segments.map(seg => {
    const safeCx = cx.replace(/<=/g, '__').replace(/[> ()]/g, '_');
    const arr = map.get(cx)?.get(seg) || [];
    return { key:`${safeCx}__${seg}`, x: cx, seg, ids: arr.map(d=>d.__id__), value: median(arr.map(d=>d[y])) };
  }));

  const yScale = d3.scaleLinear().domain([0, d3.max(barsData, d => d.value)||1]).nice().range([innerH, 0]);
  gy.call(d3.axisLeft(yScale).ticks(5));
  rotateTick(gx.call(d3.axisBottom(baseScale)))
  xLabel.text(x)
  yLabel.text(y)

  const bars = g.selectAll('rect.bar').data(barsData, d=>d.key).join('rect')
    .attr('class','bar').attr('id', d => d.key)
    .attr('x', d => baseScale(d.x) + (xOuter ? bandInner(d.seg) : 0))
    .attr('y', d => yScale(d.value) - 4)
    .attr('width', xOuter ? bandInner.bandwidth() : baseScale.bandwidth())
    .attr('height', 8)//innerH - yScale(d.value))
    .attr('fill', d => col(d.seg))
  // bars.append('title')
    //.text(d => `The median ${y} for the ${d.x} ${x} is ${d.value.toFixed(2)}.`);
  const IdsSetLocal = selectionBus.getLocal(i)
  if(IdsSetLocal)
    bars.each(function(d){
      if(d.ids.some(id => IdsSetLocal.has(id))) $(this).addClass('selected')
    })

  const localSel = new Set();
  bars.on('click', function(_, d){
    const k = d.key;
    if (localSel.has(k)){
      localSel.delete(k); 
      $(this).removeClass('selected')
      const obj = {type: "deselectDash", x: x, y: y, slot: i, value: d.value, dx: d.x, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    } else{ 
      localSel.add(k);
      $(this).addClass('selected')
      const obj = {type: "selectDash", x: x, y: y, slot: i, value: d.value, dx: d.x, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    }
    const ids = barsData.filter(b => localSel.has(b.key)).flatMap(b => b.ids);
    if (ids.length === 0)
      selectionBus.clearLocal(i);  // removes this view’s constraint
    else {
      selectionBus.setLocal(i, ids);
    }
    hoverBegin = 0
  }).on('mouseenter', (event, d) => {
    let tip = `The median <b>${y}</b> for the <b>${d.x}</b> ${x} is ${(+d.value).toLocaleString()}`
    if(selectionBus.hasAnySelection()) {
      const selRect = gs.select(`#sel_${d.key}`)
      if(!selRect.empty()){
        tip += `, while the median <b>${y}</b> for the selected is ${(+selRect.datum().selMedian).toLocaleString()}`;
      }
    }
    showTooltip(tip + '.', event.pageX, event.pageY);
    hoverBegin = getTime()
  }).on('mouseleave', (_, d) => {
    $("#tooltip").css('visibility', "hidden")
    if(hoverBegin && getTime() - hoverBegin > 2000){
      const obj = {type: "hoverDash", x: x, y: y, slot: i, value: d.value, selValue: 'none', dx: d.x, time: getFormatedTime(), userId: curUser.id}
      if(selectionBus.hasAnySelection()) {
        const selRect = gs.select(`#sel_${d.key}`)
        obj.selValue = selRect.datum().selMedian
      }
      addLog(obj)
    }
    hoverBegin = 0
  })
  if (xOuter) addLegend(d3.select(slotEl).select('.legend'), col, nice(state.slots[i].xOuter));

  function drawLinkedOverlay(sel) {
    const idSet = sel;
    const overlayData = barsData.map(b => {
      const selVals = b.ids.filter(id => idSet.has(id))
        .map(id => {
          const row = state.data.find(d => d.__id__ === id);
          return row ? +row[y] : null;
        }).filter(v => v != null && !isNaN(v));
      return {
        ...b,
        selVals: selVals,
        selMedian: selVals.length ? d3.median(selVals) : 0
      };
    }).filter(b => b.selVals.length > 0)

    // const ySel = d3.scaleLinear().domain([0, d3.max(overlayData, d => d.selCount)||1]).nice().range([innerH, 0]);
    const maxValue = d3.max(barsData, d => d.value), maxSel = d3.max(overlayData, d => d.selMedian)||1
    const yScale = d3.scaleLinear().domain([0, Math.max(maxValue, maxSel)]).nice().range([innerH, 0]);
    gy.call(d3.axisLeft(yScale).ticks(5));
    g.selectAll('rect.bar').transition().duration(1000).attr('y', d => yScale(d.value) - 4)

    const colSel = xOuter ? colorScale(segments) : d3.scaleOrdinal().domain(['__all__']).range(['#FA2A55']);
    const layer = gs.selectAll('rect.sel').data(overlayData, d => `sel_${d.key}`);
    layer.join(
      enter => enter.append('rect').attr('class','sel').attr('id', d => `sel_${d.key}`)
        .attr('x', d => baseScale(d.x) + (xOuter ? bandInner(d.seg) : 0))
        .attr('y', innerH)  // start at the baseline (bottom)
        .attr('height', 8)  // start with zero height
        .attr('width', xOuter ? bandInner.bandwidth() : baseScale.bandwidth())
        .attr('fill', d => colSel(d.seg))
        .attr('opacity', 0.55)
        .transition().duration(1000).attr('y', d => yScale(d.selMedian) - 4),
        // .attr('height', d => innerH - yScale(d.selMedian)),
      update => update
        .transition().duration(1000).attr('y', d => yScale(d.selMedian) - 4),
      exit => exit.remove()
    );
  }

  return { drawLinkedOverlay };
}

// ---------- HISTOGRAM: X numeric ----------
function drawHistogram(slotEl, i, width, height) {
  const { x, xOuter } = state.slots[i];
  const svg = d3.select(slotEl).select('svg');
  d3.select(slotEl).select(".opts").style('display', 'none')
  const { g, gx, gy, go, gs, gl, innerW, innerH, xLabel, yLabel} = baseAxes(svg, width, height, {left: 40, bottom: 40});
  g.classed('histogram', true)

  const values = state.data.map(d => d[x]).filter(v => v!=null && !isNaN(+v)).map(Number);
  if (!values.length) return;

  const baseBins = d3.bin().thresholds(20)(values);
  const xScale = d3.scaleLinear().domain([baseBins[0].x0, baseBins[baseBins.length-1].x1]).nice().range([0, innerW]);
  rotateTick(gx.call(d3.axisBottom(xScale)))
  xLabel.text(x);
  yLabel.text('count');

  const segments = xOuter ? unique(state.data.map(d => d[xOuter] ?? '(missing)')) : ['__all__'];
  const col = xOuter ? colorScale(segments) : d3.scaleOrdinal().domain(['__all__']).range(['#74add1']);
  const bandInner = xOuter ? d3.scaleBand().domain(segments).range([0, (innerW/20)*0.9]).padding(0.05) : null;

  const segBins = segments.map(seg => {
    // console.log(state.data)
    const segRows = state.data.filter(d => (xOuter ? (d[xOuter] ?? '(missing)') === seg : true) && d[x]!=null && !isNaN(+d[x]));
    const vals = segRows.map(d => +d[x]);

    const bins = d3.bin().domain(xScale.domain()).thresholds(20)(vals);
    bins.forEach((b) => {
      const x0 = b.x0, x1 = b.x1;
      // console.log(segRows)
      b.ids = segRows.filter(d => +d[x] >= x0 && +d[x] < x1).map(d=>d.__id__);
    });
    return { seg, bins };
  });
  // console.log(segBins)

  const yMax = d3.max(segBins.flatMap(s => s.bins), b => b.length) || 1;
  const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);
  gy.call(d3.axisLeft(yScale).ticks(5));

  g.append('rect').attr("x", 0)
    .attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .style("fill", "none")
    .style("pointer-events", "all");

  segBins.forEach(s => {
    g.selectAll(`rect.bin`)//-${CSS.escape(s.seg)}`)
      .data(s.bins)
      .join('rect')
      .attr('class', 'bin')//.attr('id', `bin_${b.x0}_${b.x1}`)
      .attr('x', b => xScale(b.x0) + (xOuter ? bandInner(s.seg) : 0))
      .attr('y', b => {
        let h = innerH - yScale(b.length)
        // console.log(y)
        if(h && h < 5) return innerH - 5
        return yScale(b.length)
      }).attr('width', b => xOuter ? bandInner.bandwidth() : Math.max(10, xScale(b.x1) - xScale(b.x0) - 1))
      .attr('height', b => {
        let h = innerH - yScale(b.length)
        // console.log(h)
        if(h && h < 5) return 5
        return h
      })
      .attr('fill', col(s.seg))
  });

  if (xOuter) addLegend(d3.select(slotEl).select('.legend'), col, nice(state.slots[i].xOuter));
  const IdsSetLocal = selectionBus.getLocal(i)
  if(IdsSetLocal)
    g.selectAll(`rect.bin`).each(function(d){
      if(d.ids.some(id => IdsSetLocal.has(id))) $(this).addClass('selected')
    })

  g.selectAll('rect.bin').on('mouseenter', (event, d) => {
    let tip = `There are ${d.length} ${tutorial ? 'instances': 'individuals'} with ${x} between ${(+d.x0).toLocaleString()} and ${(+d.x1).toLocaleString()}`
    if(selectionBus.hasAnySelection()) {
      const selRect = gs.select(`#sel_${String(d.x0).replace('.', '')}_${String(d.x1).replace('.', '')}`)
      if(!selRect.empty()){
        tip += `, of ${tutorial ? 'which': 'whom'} ${selRect.datum().countSel} are selected`;
      }
    }
    showTooltip(tip + '.', event.pageX, event.pageY)
    hoverBegin = getTime()
  }).on("mouseleave", function(event, d){
    $("#tooltip").css('visibility', "hidden")
    if(hoverBegin && getTime() - hoverBegin > 2000){
      const obj = {type: "hoverBin", x0: d.x0, x1: d.x1, value: d.length, selValue: 'none', time: getFormatedTime(), userId: curUser.id}
      if(selectionBus.hasAnySelection()) {
        const selRect = gs.select(`#sel_${String(d.x0).replace('.', '')}_${String(d.x1).replace('.', '')}`)
        obj.selValue = selRect?.datum().countSel
      }
      addLog(obj)
    }
    hoverBegin = 0
  })

  const brush = d3.brushX().extent([[0,0],[innerW, innerH]]).on('start', ({ selection, sourceEvent }) => {
      // detect plain click with no drag (brush start)
      if (sourceEvent && sourceEvent.type === 'mousedown') {
        // If there’s *no existing* selection rectangle drawn yet,
        // this is a click in empty space — clear selection.
        if (!selectionBus.isBrushing){
          if(selectionBus.getLocal(i).size == 0) return
          selectionBus.clearLocal(i);
          g.selectAll('rect.bin').classed('selected', false)
          const obj = {type: "clearSelection", chart: 'histogram', slot: i, time: getFormatedTime(), userId: curUser.id}
          addLog(obj)
          hoverBegin = 0
        }
      }
      selectionBus.isBrushing = true;
      // $(facet.node()).find('.brush .overlay').css('pointer-events', 'all')
    }).on('end', ({selection}) => {
      selectionBus.isBrushing = false;
      $(go.node()).find('.overlay').css('pointer-events', 'none')

    if (!selection) { 
      return; 
    }
    const [px0, px1] = selection;
    const x0 = xScale.invert(px0), x1 = xScale.invert(px1);
    const ids = [], selectedBins = new Set()

    g.selectAll('rect.bin').classed('selected', b => {
      if (b.x1 >= x0 && b.x0 < x1){ 
        ids.push(...b.ids);
        selectedBins.add(`bin_${b.x0}_${b.x1}`);
        return true
      }
      return false
    })
    
    // console.log(ids)
    if(ids.length != 0){
      selectionBus.setLocal(i, ids);
      const obj = {type: "select", chart: 'histogram', slot: i, ids: ids, bins: selectedBins, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
      hoverBegin = 0
    }

    // Draw black outlines around selected bins
    
    go.call(brush.move, null);
  });
  go.call(brush);

  g.on('mousedown', function(event){
    // console.log("mouse downnn")
    if (event.synthetic) return;
    const brushOverlay = $(this).parent().find('.brush .overlay')
    brushOverlay.css('pointer-events', 'all')
    const newEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      buttons: event.buttons,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      view: window,
    });
    newEvent.synthetic = true
    brushOverlay.get(0).dispatchEvent(newEvent);
    event.preventDefault();
  })

  function drawLinkedOverlay(sel) {
    const idSet = sel;
    const overlayRects = [];
    segBins.forEach(s => s.bins.forEach(b => {
      const countSel = b.ids.filter(id => idSet.has(id)).length;
      if (countSel > 0) overlayRects.push({ seg:s.seg, x0:b.x0, x1:b.x1, countSel });
    }));
    // const ySel = d3.scaleLinear().domain([0, d3.max(overlayRects, d=>d.countSel)||1]).nice().range([innerH, 0]);
    const colSel = xOuter ? colorScale(segments) : d3.scaleOrdinal().domain(['__all__']).range(['#FA2A55']);
    const layer = gs.selectAll('rect.sel').data(overlayRects, d => `sel_${d.seg}_${String(d.x0).replace('.', '')}_${String(d.x1).replace('.', '')}`);
    layer.join(
      enter => enter.append('rect').attr('class','sel').attr('id', d => `sel_${String(d.x0).replace('.', '')}_${String(d.x1).replace('.', '')}`)
        .attr('x', d => xScale(d.x0) + (xOuter ? bandInner(d.seg) : 0))
        .attr('y', innerH)
        .attr('width', d => xOuter ? bandInner.bandwidth() : Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))
        .attr('height', 0)
        .attr('fill', d => colSel(d.seg))
        .attr('opacity', 0.55)
        .transition().duration(1000).attr('height', d => {
          let h = innerH - yScale(d.countSel)
          // console.log(y)
          if(h && h < 5) return 5
          return innerH - yScale(d.countSel)
        }).attr('y', d => {
          let h = innerH - yScale(d.countSel)
          // console.log(y)
          if(h && h < 5) return innerH - 5
          return yScale(d.countSel)
        }),
      update => update.transition().duration(1000).attr('height', d => {
          let h = innerH - yScale(d.countSel)
          // console.log(y)
          if(h && h < 5) return 5
          return innerH - yScale(d.countSel)
        }).attr('y', d => {
          let h = innerH - yScale(d.countSel)
          // console.log(y)
          if(h && h < 5) return innerH - 5
          return yScale(d.countSel)
        }),
      exit => exit.remove()
    );
  }

  return { drawLinkedOverlay };
}

