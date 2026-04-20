// ---------- HEATMAP: X & Y categorical ----------
function drawHeatmapCatCat(slotEl, i, width, height) {
  const { x, y, xOuter, yOuter } = state.slots[i];
  const svg = d3.select(slotEl).select('svg');
  d3.select(slotEl).select(".opts").style('display', null)
  const bottom = estimatedTickMargin(ORDINAL_ORDERS[x]) + 20 + 15;
  const left = estimatedTickMargin(ORDINAL_ORDERS[y], 'left') + 20;
  const { g, gx, gy, go, gs, gt, gl, innerW, innerH, xLabel, yLabel } = baseAxes(svg, width, height, {left: left, bottom: bottom});
  g.classed('heatmap', true)

  const facetsX = xOuter ? unique(state.data.map(d => d[xOuter] ?? '(missing)')) : ['__all__'];
  const facetsY = yOuter ? unique(state.data.map(d => d[yOuter] ?? '(missing)')) : ['__single__'];
  const facetW = innerW / facetsX.length;
  const facetH = innerH / facetsY.length;

  let catsX = unique(state.data.map(d => d[x] ?? '(missing)'));
  let catsY = unique(state.data.map(d => d[y] ?? '(missing)'));
  catsX = ORDINAL_ORDERS[x].filter(c => catsX.indexOf(c) > -1)
  catsY = ORDINAL_ORDERS[y].filter(c => catsY.indexOf(c) > -1)

  const xScale = d3.scaleBand().domain(catsX).range([0, facetW]).padding(0.05);
  const yScale = d3.scaleBand().domain(catsY).range([facetH, 0]).padding(0.05);

  rotateTick(gx.call(d3.axisBottom(d3.scaleBand().domain(catsX).range([0, innerW]))))
  rotateTick(gy.call(d3.axisLeft(d3.scaleBand().domain(catsY).range([innerH, 0]))), false)
  xLabel.text(x)
  yLabel.text(y)

  const allCells = [];
  facetsY.forEach((fy, yi) => {
    facetsX.forEach((fx, xi) => {
      const sub = state.data.filter(d =>
        (yOuter ? (d[yOuter] ?? '(missing)') === fy : true) &&
        (xOuter ? (d[xOuter] ?? '(missing)') === fx : true)
      );
      const byXY = d3.rollups(sub, v => v, d => d[x] ?? '(missing)', d => d[y] ?? '(missing)');
      const map = new Map(byXY.map(([cx, arr]) => [cx, new Map(arr)]));
      catsX.forEach(cx => catsY.forEach(cy => {
        const safeCx = cx.replace(/<=/g, '__').replace(/[> ()]/g, '_');
        const safeCy = cy.replace(/<=/g, '__').replace(/[> ()]/g, '_');
        const arr = map.get(cx)?.get(cy) || [];
        allCells.push({ key:`${xi}_${yi}_${safeCx}_${safeCy}`, xi, yi, x: cx, y: cy, ids: arr.map(d => d.__id__), value: arr.length, count: arr.length });
      }));
    });
  });

  // Apply percentage normalization if requested
  if (state.slots[i].percentageMode === 'percent') {
    const by = state.slots[i].percentBy;
    // aggregate row/column totals within each facet
    const rowTotals = d3.rollup(allCells, v => d3.sum(v, d => d.value), d => d.y);
    const colTotals = d3.rollup(allCells, v => d3.sum(v, d => d.value), d => d.x);
    allCells.forEach(d => {
      const denom = by === 'row' ? (rowTotals.get(d.y) || 1) : (colTotals.get(d.x) || 1);
      d.value = denom ? d.value / denom : 0;
    });
  }
  // const vMax = state.slots[i].percentageMode === 'percent' ? 1 : d3.max(allCells, d => d.value) || 1;
  const vMax = d3.max(allCells, d => d.value)
  const cScale = d3.scaleSequential(d3.interpolateBlues).domain([0, vMax]);
// console.log(vMax)
  const facet = g.selectAll('g.facet')
    .data(facetsX.flatMap((fx, xi) => facetsY.map((fy, yi) => ({fx, fy, xi, yi}))))
    .join('g')
    .attr('class','facet')
    .attr('transform', d => `translate(${d.xi * facetW},${d.yi * facetH})`);

//to catch mouse events
  facet.append('rect').attr("x", 0)
    .attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .style("fill", "none")
    .style("pointer-events", "all");
  const cells = facet.selectAll('rect.cell')
    .data(d => allCells.filter(c => c.xi===d.xi && c.yi===d.yi))
    .join('rect')
    .attr('class','cell')
    .attr('x', d => xScale(d.x))
    .attr('y', d => yScale(d.y))
    .attr('width', xScale.bandwidth())
    .attr('height', yScale.bandwidth())
    .attr('fill', d => cScale(d.value))
    .attr('opacity', d => {if(d.value) return 1; return 0})

  // const localSel = new Set()
  // cells.on('click', function(_, d){
  //   const k = d.key; // unique key for this cell

  //   // Toggle this cell in the local selection
  //   if (localSel.has(k)) {
  //     localSel.delete(k);
  //     $(this).removeClass('selected')
  //   } else {
  //     localSel.add(k);
  //     $(this).addClass('selected')
  //   }
  const IdsSetLocal = selectionBus.getLocal(i)
  if(IdsSetLocal)
    facet.selectAll('rect.cell').each(function(d){
      if(d.ids.some(id => IdsSetLocal.has(id))) $(this).addClass('selected')
    })
  
  makeHeatmapBrush({facet, go,
    xScale,
    yScale,
    allCells,
    facetW,
    facetH,
    i,
    // localSel
  })

  function drawLinkedOverlay(sel) {
    const idSet = sel;
    let cScaleSel, sMax = 0 // 
    let overlayCells = []
    if(selectionBus.hasAnySelection()){
      overlayCells = allCells.map(c => {
          const selValue = c.ids.filter(id => idSet.has(id)).length;
          if(sMax < selValue) sMax = selValue
          return {...c, selValue, selPercent: c.count ? selValue/c.count : 0}
      })
    }else{
      drawHeatmapLegend(gl, cScale, {
        title: '',
        format: state.slots[i].percentageMode === 'count' ? d3.format('~s') : d3.format('.0%'),
        marginTop: innerH + bottom  - 30
      });
    }
    // Determine per-row or per-column totals depending on mode
    // let overlayColorCells = [];
    if (state.slots[i].percentageMode === 'percent') {
      const by = state.slots[i].percentBy;
      sMax = 0
      // aggregate row/column totals within each facet
      const rowSel = d3.rollup(overlayCells, v => d3.sum(v, d => d.selValue), d => d.y);
      const colSel = d3.rollup(overlayCells, v => d3.sum(v, d => d.selValue), d => d.x);
      overlayCells.forEach(d => {
        const denom = by === 'row' ? (rowSel.get(d.y) || 1) : (colSel.get(d.x) || 1);
        d.selValue = denom ? d.selValue / denom : 0;
        if(sMax < d.selValue) sMax = d.selValue
      });
    }

    cScaleSel = d3.scaleSequential(d3.interpolateReds).domain([0, sMax])
    if(selectionBus.hasAnySelection()){
      drawHeatmapLegend(gl, cScaleSel, {
        title: '',
        format: state.slots[i].percentageMode === 'count' ? d3.format('~s') : d3.format('.0%'),
        marginTop: innerH + bottom - 30
      });
    }

    const groups = gs.selectAll('g.selFacet')
      .data(facetsX.flatMap((fx, xi) => facetsY.map((fy, yi) => ({fx, fy, xi, yi}))))
      .join('g')
      .attr('class','selFacet')
      .attr('transform', d => `translate(${d.xi * facetW},${d.yi * facetH})`);
    groups.selectAll('rect.sel')
      .data(d => overlayCells.filter(c => c.xi===d.xi && c.yi===d.yi), d=>d.key)
      .join(enter => enter.append('rect')
        .attr('class', 'sel').attr('id', d => `sel_${d.key}`)
        .attr('x', d => xScale(d.x) + (.5-.45*d.selPercent) * xScale.bandwidth()/2)
        .attr('y', d => yScale(d.y) + (.5-.45*d.selPercent) * yScale.bandwidth()/2)
        .attr('width', d => (.5 + .45 * d.selPercent) * xScale.bandwidth())
        .attr('height', d => (.5 + .45 * d.selPercent) * yScale.bandwidth())
        .attr('rx', 5)
        .attr('ry', 5)
        .attr('opacity', d => {if(!d.selValue) return 0; return 1})
        .attr('fill', '#fff').transition().duration(1000)
        .attr('fill', d => cScaleSel(d.selValue)),
      update => update.transition().duration(1000)
        .attr('fill', d => cScaleSel(d.selValue))
        .attr('opacity', d => {if(!d.selValue) return 0; return 1})
        .attr('x', d => xScale(d.x) + (.5-.45*d.selPercent) * xScale.bandwidth()/2)
        .attr('y', d => yScale(d.y) + (.5-.45*d.selPercent) * yScale.bandwidth()/2)
        .attr('width', d => (.5 + .45 * d.selPercent) * xScale.bandwidth())
        .attr('height', d => (.5 + .45 * d.selPercent) * yScale.bandwidth()),
      exit => exit.remove()
      )

    const textgroups = gt.selectAll('g.textFacet')
      .data(facetsX.flatMap((fx, xi) => facetsY.map((fy, yi) => ({fx, fy, xi, yi}))))
      .join('g')
      .attr('class','textFacet')
      .attr('transform', d => `translate(${d.xi * facetW},${d.yi * facetH})`);
    textgroups.selectAll('text.heatLabel').data(d => allCells.filter(c => c.xi===d.xi && c.yi===d.yi), d=>d.key)
    .join(
      enter => enter.append('text')
        .attr('class','heatLabel')
        .attr('x', d => xScale(d.x) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.y) + yScale.bandwidth() / 2)
        .text(function(d){
          let text, fill;
          if(state.slots[i].percentageMode === 'percent'){
            if(selectionBus.hasAnySelection()){
              text = `${(gs.select(`#sel_${d.key}`).datum().selValue * 100).toFixed(1)}%`
            }
            else text = `${(d.value*100).toFixed(1)}%`
          }else{
            if(selectionBus.hasAnySelection()) text = gs.select(`#sel_${d.key}`).datum().selValue
            else text = d.value
          }
          if(selectionBus.hasAnySelection()) fill = cScaleSel(gs.select(`#sel_${d.key}`).datum().selValue)
          else fill = cScale(d.value)
          d3.select(this).style('fill', isDark(fill) ? '#eee' : '#111')
          return text
        }).style('display', d => {if(xScale.bandwidth() < 30) return 'none'; return null}),
      update => update.text(function(d){
          let text, fill;
          if(state.slots[i].percentageMode === 'percent'){
            if(selectionBus.hasAnySelection()){
              text = `${(gs.select(`#sel_${d.key}`).datum().selValue * 100).toFixed(1)}%`
            }
            else text = `${(d.value*100).toFixed(1)}%`
          }else{
            if(selectionBus.hasAnySelection()) text = gs.select(`#sel_${d.key}`).datum().selValue
            else text = d.value
          }
          if(selectionBus.hasAnySelection()) fill = cScaleSel(gs.select(`#sel_${d.key}`).datum().selValue)
          else fill = cScale(d.value)
          d3.select(this).style('fill', isDark(fill) ? '#eee' : '#111')
          return text
        }),
      exit => exit.remove()
    )

    g.selectAll('rect.cell').on("mouseenter", function(event, d){
      let tip = '', selRect = null;
      if(selectionBus.hasAnySelection()) selRect = gs.select(`#sel_${d.key}`)
      if(state.slots[i].percentageMode === 'percent'){
        if (state.slots[i].percentBy === "row") {
          tip += `Among ${tutorial ? 'instances': 'individuals'} with <b>${d.y}</b> ${y}, ` 
          if(selRect && !selRect.empty()) tip += `${(selRect.datum().selValue * 100).toFixed(1)}% in the SELECTION and<br/>`
          tip += `${(d.value*100).toFixed(1)}% in the dataset have a <b>${d.x}</b> ${x}.`;
        }
        else{
          tip += `Among ${tutorial ? 'instances': 'individuals'} with <b>${d.x}</b> ${x}, `
          if(selRect && !selRect.empty()) tip += `${(selRect.datum().selValue * 100).toFixed(1)}% in the SELECTION and<br/>`;
          tip += `${(d.value*100).toFixed(1)}% in the dataset have <b>${d.y}</b> ${y}.`
        }
      }
      else{
        if(selRect && !selRect.empty()) tip += `There are ${selRect.datum().selValue} SELECTED ${tutorial ? 'instances': 'individuals'} with <b>${d.x}</b> ${x} and <b>${d.y}</b> ${y}.<br/>`;
        tip += `In total, there are ${d.value} ${tutorial ? 'instances': 'individuals'} with <b>${d.x}</b> ${x} and <b>${d.y}</b> ${y}.`
      }
      // console.log(tip)
      // return tip
      showTooltip(tip, event.pageX, event.pageY)
      hoverBegin = getTime()
    }).on("mouseleave", function(event, d){
      $("#tooltip").css('visibility', "hidden")
      if(hoverBegin && getTime() - hoverBegin > 2000){
        let selRect = null
        if(selectionBus.hasAnySelection()) selRect = gs.select(`#sel_${d.key}`)
        const obj = {type: "hoverCatCatCell", x: x, y: y, dx: d.x, dy: d.y, value: d.value, selValue: selRect ? selRect.datum().selValue: 'none', time: getFormatedTime(), userId: curUser.id}
        addLog(obj)
      }
      hoverBegin = 0
    })//.text(d => {//(${x}: <b>${d.x}</b>, ${y}: <b>${d.y}</b>) → <b>${state.slots[i].percentageMode === 'percent' ? Math.round(d.value * 100) + '%' : d.value}</b>`);
  }

  return { drawLinkedOverlay };
}

// ---------- HEATMAP: X numeric & (Y categorical) ----------
function drawHeatmapNumAny(slotEl, i, width, height) {
  const { x, y, xOuter, yOuter } = state.slots[i];
  const svg = d3.select(slotEl).select('svg');
  d3.select(slotEl).select(".opts").style('display', null)

  const yType = y ? state.types[y] : null;
  let yCats=null, yExtent=null, isYCat=false;
  if (!y) { yCats = ['•']; isYCat = true; }
  if (y && yType === 'cat') { yCats = unique(state.data.map(d => d[y] ?? '(missing)')); yCats = ORDINAL_ORDERS[y].filter(c => yCats.indexOf(c) > -1); isYCat = true; }
  if (y && yType === 'num') { isYCat = false; const yy = state.data.map(d=>d[y]).filter(v=>v!=null && !isNaN(+v)).map(Number); yExtent = d3.extent(yy); yExtent = [Math.floor(yExtent[0]), Math.ceil(yExtent[1])]}

  let left = 40
  if(isYCat) left = estimatedTickMargin(ORDINAL_ORDERS[y], 'left') + 20;
  const { g, gx, gy, go, gs, gt, gl, innerW, innerH, xLabel, yLabel } = baseAxes(svg, width, height, {left: left, bottom: 55});
  g.classed('heatmap', true)

  const facetsX = xOuter ? unique(state.data.map(d => d[xOuter] ?? '(missing)')) : ['__single__'];
  const facetsY = yOuter ? unique(state.data.map(d => d[yOuter] ?? '(missing)')) : ['__single__'];
  const facetW = innerW / facetsX.length;
  const facetH = innerH / facetsY.length;

  const xVals = state.data.map(d => d[x]).filter(v => v!=null && !isNaN(+v)).map(Number);
  if (!xVals.length) return;
  let xExtent = d3.extent(xVals);
  xExtent = [Math.floor(xExtent[0]), Math.ceil(xExtent[1])];
  const xScaleGlobal = d3.scaleLinear().domain(xExtent).nice().range([0, facetW]);

  rotateTick(gx.call(d3.axisBottom(d3.scaleLinear().domain(xExtent).range([0, innerW]))))
  if (isYCat) rotateTick(gy.call(d3.axisLeft(d3.scaleBand().domain(yCats).range([innerH, 0]))), false)
  else rotateTick(gy.call(d3.axisLeft(d3.scaleLinear().domain(yExtent).range([innerH, 0]))))
  xLabel.text(x)
  yLabel.text(y)

  const allCells = [];
  facetsY.forEach((fy, yi) => {
    facetsX.forEach((fx, xi) => {
      const sub = state.data.filter(d =>
        (yOuter ? (d[yOuter] ?? '(missing)') === fy : true) &&
        (xOuter ? (d[xOuter] ?? '(missing)') === fx : true)
      );
      if (isYCat) {
        const cats = yCats || ['•'];
        let binWidth = (xExtent[1]-xExtent[0]) / DEFAULT_HEATMAP_BINS;
        if(binWidth > 1) binWidth = Math.floor(binWidth)
        else binWidth = binWidth.toFixed(1)
        const buckets = new Map();
        sub.forEach(d => {
          const xv = +d[x]; if(isNaN(xv)) return;
          const bx = Math.min(DEFAULT_HEATMAP_BINS, Math.max(0, Math.floor((xv - xExtent[0]) / binWidth)));
          const ky = y ? (d[y] ?? '(missing)') : '•';
          const key = `${bx}__${ky}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(d.__id__);
        });
        for (let bi = 0; bi <= DEFAULT_HEATMAP_BINS; bi++) {
          cats.forEach(cy => {
            const safeCy = cy.replace(/<=/g, '__').replace(/[> ()]/g, '_')
            const ids = buckets.get(`${bi}__${cy}`) || [];
            allCells.push({ xi, yi, xBin: bi, x0: xExtent[0] + bi*binWidth, x1: xExtent[0] + (bi+1)*binWidth, y: cy, ids, value: ids.length, key: `${xi}_${yi}_${bi}_${safeCy}`, count: ids.length });
          });
        }
      } else {
        const binWx = Math.floor((xExtent[1]-xExtent[0])/DEFAULT_HEATMAP_BINS);
        const binWy = Math.floor((yExtent[1]-yExtent[0])/DEFAULT_HEATMAP_BINS);
        const buckets = new Map();
        sub.forEach(d => {
          const xv = +d[x], yv = +d[y];
          if (isNaN(xv) || isNaN(yv)) return;
          const bxi = Math.min(DEFAULT_HEATMAP_BINS, Math.max(0, Math.floor((xv - xExtent[0])/binWx)));
          const byi = Math.min(DEFAULT_HEATMAP_BINS, Math.max(0, Math.floor((yv - yExtent[0])/binWy)));
          const key = `${bxi}_${byi}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(d.__id__);
        });
        for (let bxi = 0; bxi <= DEFAULT_HEATMAP_BINS; bxi++) {
          for (let byi = 0;byi <= DEFAULT_HEATMAP_BINS; byi++) {
            const ids = buckets.get(`${bxi}_${byi}`) || [];
            allCells.push({ xi, yi, xBin:bxi, yBin:byi, x0: xExtent[0] + bxi*binWx, x1: xExtent[0] + (bxi+1)*binWx, y0: yExtent[0] + byi*binWy, y1: yExtent[0] + (byi+1)*binWy, ids, value: ids.length, count: ids.length, key: `${xi}_${yi}_${bxi}_${byi}` });
          }
        }
      }
    });
  });

  if (state.slots[i].percentageMode === 'percent') {
    const by = state.slots[i].percentBy;
    const rowTotals = d3.rollup(allCells, v => d3.sum(v, d => d.value), d => d.y || Math.floor(d.yBin ?? 0));
    const colTotals = d3.rollup(allCells, v => d3.sum(v, d => d.value), d => Math.floor(d.xBin ?? 0));
    allCells.forEach(d => {
      const denom = by === 'row' ? (rowTotals.get(d.y || Math.floor(d.yBin ?? 0)) || 1)
        : (colTotals.get(Math.floor(d.xBin ?? 0)) || 1);
      d.value = denom ? d.value / denom : 0;
    });
  }

  const vMax = state.slots[i].percentageMode === 'percent' ? 1 : d3.max(allCells, d => d.value) || 1;
  const cScale = d3.scaleSequential(d3.interpolateBlues).domain([0, vMax]);
  let yScale

  const facet = g.selectAll('g.facet')
    .data(facetsX.flatMap((fx, xi) => facetsY.map((fy, yi) => ({fx, fy, xi, yi}))))
    .join('g')
    .attr('class','facet')
    .attr('transform', d => `translate(${d.xi * facetW},${d.yi * facetH})`);

  facet.append('rect').attr("x", 0)
    .attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .style("fill", "none")
    .style("pointer-events", "all");

  if (isYCat) yScale = d3.scaleBand().domain(yCats).range([facetH, 0]).padding(0.05);
  else yScale = d3.scaleLinear().domain(yExtent).range([facetH, 0]);
  facet.selectAll('rect.cell')
    .data(d => allCells.filter(c => c.xi===d.xi && c.yi===d.yi))
    .join('rect')
    .attr('class','cell')
    .attr('x', d => xScaleGlobal(d.x0))
    .attr('y', d => {if(isYCat) return yScale(d.y); return yScale(d.y1)})
    .attr('width', d => Math.max(1, xScaleGlobal(d.x1) - xScaleGlobal(d.x0) - 1))
    .attr('height', d => {if(isYCat) return yScale.bandwidth(); return Math.max(1, yScale(d.y0) - yScale(d.y1) - 1)})
    .attr('fill', d => cScale(d.value))
    .attr('opacity', d => {if(d.value) return 1; return 0})

    // .on('click', (_, d) => selectionBus.replace(d.ids))
    // .append('title')
    // .text(d => `[${x}: ${d.x0} - ${d.x1}, ${y}: ${d.y}] → ${state.slots[i].percentageMode === 'percent' ? Math.round(d.value * 100) + '%' : d.value}`);

  makeHeatmapBrush({facet, go, 
    xScale: xScaleGlobal,
    yScale,
    allCells,
    facetW,
    facetH,
    i
  })
  //it does not work to put brush in overlay-layer, as the mouse events are captured and no tooltip for the chart

  const IdsSetLocal = selectionBus.getLocal(i)
  if(IdsSetLocal)
    facet.selectAll('rect.cell').each(function(d){
      if(d.ids.some(id => IdsSetLocal.has(id))) $(this).addClass('selected')
    })

  g.selectAll('rect.cell').on("mouseenter", function(event, d){
    let tip = '', selRect = null;
    if(selectionBus.hasAnySelection()) selRect = gs.select(`#sel_${d.key}`)
    if(state.slots[i].percentageMode === 'percent'){
      if (state.slots[i].percentBy === "row") {
        if(isYCat) tip += `Among ${tutorial ? 'instances': 'individuals'} with <b>${d.y}</b> ${y}, `
        else tip += `Among ${tutorial ? 'instances': 'individuals'} with ${y} <b>${(+d.y0).toLocaleString()} - ${(+d.y1).toLocaleString()}</b>, `
        if(selRect && !selRect.empty()) tip += `${(selRect.datum().selValue * 100).toFixed(1)}% in the SELECTION and<br/>`
        tip += `${(d.value*100).toFixed(1)}% in the dataset have a ${x} <b>${(+d.x0).toLocaleString()} - ${(+d.x1).toLocaleString()}</b>.`;
      }
      else{
        tip += `Among individuals with ${x} <b>${(+d.x0).toLocaleString()} - ${(+d.x1).toLocaleString()}</b>, `
        if(selRect && !selRect.empty()) tip += `${(selRect.datum().selValue * 100).toFixed(1)}% in the SELECTION and<br/>`;
        if(isYCat) tip += `${(d.value*100).toFixed(1)}% in the dataset have <b>${d.y}</b> ${y}.`
        else tip += `${(d.value*100).toFixed(1)}% in the dataset have ${y} <b>${(+d.y0).toLocaleString()} - ${(+d.y1).toLocaleString()}</b>.`
      }
    }
    else{
      if(isYCat){
        if(selRect && !selRect.empty()) tip += `There are ${selRect.datum().selValue} SELECTED ${tutorial ? 'instances': 'individuals'} with ${x} <b>${(+d.x0).toLocaleString()} - ${(+d.x1).toLocaleString()}</b> and <b>${d.y}</b> ${y}.<br/>`;
        tip += `In total, there are ${d.value} ${tutorial ? 'instances': 'individuals'} with ${x} <b>${(+d.x0).toLocaleString()} - ${(+d.x1).toLocaleString()}</b> and <b>${d.y}</b> ${y}.`
      }else{
        if(selRect && !selRect.empty()) tip += `There are ${selRect.datum().selValue} SELECTED ${tutorial ? 'instances': 'individuals'} with ${x} <b>${d.x0} - ${d.x1}</b> and ${y} <b>${d.y0} - ${d.y1}</b>.<br/>`;
        tip += `In total, there are ${d.value} ${tutorial ? 'instances': 'individuals'} with ${x} <b>${d.x0} - ${d.x1}</b> and ${y} <b>${d.y0} - ${d.y1}</b>.`
      }
    }

    showTooltip(tip, event.pageX, event.pageY)
    hoverBegin = getTime()
  }).on("mouseleave", function(event, d){
    $("#tooltip").css('visibility', "hidden")
    if(hoverBegin && getTime() - hoverBegin > 2000){
      let selRect = null, obj = {x: x, dx: `${d.x0} - ${d.x1}`, time: getFormatedTime(), userId: curUser.id}
      if(selectionBus.hasAnySelection()) selRect = gs.select(`#sel_${d.key}`)
      if(isYCat){
        obj.type = "hoverNumCatCell"
        obj.y = y; obj.dy = d.y; obj.value = d.value; obj.selValue = selRect ? selRect.datum().selValue: 'none'
      } else {
        obj.type = "hoverNumNumCell"
        obj.y = y; obj.dy = `${d.y0} - ${d.y1}`; obj.value = d.value; obj.selValue = selRect ? selRect.datum().selValue: 'none'
      }
      addLog(obj)
    }
    hoverBegin = 0
  })

  function drawLinkedOverlay(sel) {
    const idSet = sel;
    let cScaleSel, sMax = 0
    let overlayCells = []
    if(selectionBus.hasAnySelection()){
      overlayCells = allCells.map(c => {
        const selValue = c.ids.filter(id => idSet.has(id)).length
        if(selValue > sMax) sMax = selValue
        return {...c, selValue, selPercent: c.count ? selValue/c.count: 0 }
      })//.filter(c => c.selCount>0);
    }else{
      drawHeatmapLegend(gl, cScale, {
        title: '',
        format: state.slots[i].percentageMode === 'count' ? d3.format('~s') : d3.format('.0%'),
        marginTop: innerH + 35
      });
    }

    if (state.slots[i].percentageMode === 'percent') {
      sMax = 0
      const by = state.slots[i].percentBy;
      // aggregate row/column totals within each facet
      const rowSel = d3.rollup(overlayCells, v => d3.sum(v, d => d.selValue), d => d.y || Math.floor(d.yBin ?? 0));
      const colSel = d3.rollup(overlayCells, v => d3.sum(v, d => d.selValue), d => Math.floor(d.xBin ?? 0));
      overlayCells.forEach(d => {
        const denom = by === 'row' ? (rowSel.get(d.y || Math.floor(d.yBin ?? 0)) || 1) : (colSel.get(Math.floor(d.xBin ?? 0)) || 1);
        d.selValue = denom ? d.selValue / denom : 0;
        if(sMax < d.selValue) sMax = d.selValue
      });
    }

    cScaleSel = d3.scaleSequential(d3.interpolateReds).domain([0, sMax]);
    if(selectionBus.hasAnySelection()){
      drawHeatmapLegend(gl, cScaleSel, {
        title: '',
        format: state.slots[i].percentageMode === 'count' ? d3.format('~s') : d3.format('.0%'),
        marginTop: innerH + 35
      });
    }

    const groups = gs.selectAll('g.selFacet')
      .data(facetsX.flatMap((fx, xi) => facetsY.map((fy, yi) => ({fx, fy, xi, yi}))))
      .join('g')
      .attr('class','selFacet')
      .attr('transform', d => `translate(${d.xi * facetW},${d.yi * facetH})`);

    groups.selectAll('rect.sel')
      .data(d => overlayCells.filter(c => c.xi===d.xi && c.yi===d.yi))
      .join(enter => enter.append('rect')
        .attr('class','sel').attr('id', d => `sel_${d.key}`)
        .attr('x', d => xScaleGlobal(d.x0) + (.5 - .45 * d.selPercent) * Math.max(10, xScaleGlobal(d.x1) - xScaleGlobal(d.x0) - 1)/2)
        .attr('y', d => {if(isYCat) return yScale(d.y) + (.5 - .45 * d.selPercent) * yScale.bandwidth()/2;
          let w = Math.max(5, yScale(d.y0) - yScale(d.y1) - 1)
          return yScale(d.y1) + (.5 - .45 * d.selPercent) * w / 2
        }).attr('width', d => (.5 + .45 * d.selPercent) * Math.max(10, xScaleGlobal(d.x1) - xScaleGlobal(d.x0) - 1))
        .attr('height', d => {if(isYCat) return (.5 + .45 * d.selPercent) * yScale.bandwidth(); return (.5 + .45 * d.selPercent) * Math.max(5, yScale(d.y0) - yScale(d.y1) - 1)})
        .attr('rx', 5)
        .attr('ry', 5)
        .attr('opacity', d => {if(!d.selValue) return 0; return 1})
        .attr('fill', '#fff').transition().duration(1000)
        .attr('fill', d => cScaleSel(d.selValue)),
        update => update.transition().duration(1000).attr('fill', d => cScaleSel(d.selValue))
                    .attr('opacity', d => {if(!d.selValue) return 0; return 1})
                    .attr('x', d => xScaleGlobal(d.x0) + (.5 - .45 * d.selPercent) * Math.max(10, xScaleGlobal(d.x1) - xScaleGlobal(d.x0) - 1)/2)
                    .attr('y', d => {if(isYCat) return yScale(d.y) + (.5 - .45 * d.selPercent) * yScale.bandwidth()/2;
                      let w = Math.max(5, yScale(d.y0) - yScale(d.y1) - 1)
                      return yScale(d.y1) + (.5 - .45 * d.selPercent) * w / 2
                    }).attr('width', d => (.5 + .45 * d.selPercent) * Math.max(10, xScaleGlobal(d.x1) - xScaleGlobal(d.x0) - 1))
                    .attr('height', d => {if(isYCat) return (.5 + .45 * d.selPercent) * yScale.bandwidth(); return (.5 + .45 * d.selPercent) * Math.max(5, yScale(d.y0) - yScale(d.y1) - 1)}),
        exit => exit.remove()
      )

    const textgroups = gt.selectAll('g.textFacet')
      .data(facetsX.flatMap((fx, xi) => facetsY.map((fy, yi) => ({fx, fy, xi, yi}))))
      .join('g')
      .attr('class','textFacet')
      .attr('transform', d => `translate(${d.xi * facetW},${d.yi * facetH})`);

    textgroups.selectAll('text.heatLabel').data(d => allCells.filter(c => c.xi===d.xi && c.yi===d.yi), d=>d.key)
    .join(
      enter => enter.append('text')
        .attr('class','heatLabel')
        .attr('x', d => (xScaleGlobal(d.x1) + xScaleGlobal(d.x0)) / 2)
        .attr('y', d => {if(isYCat) return yScale(d.y) + yScale.bandwidth() / 2; return (yScale(d.y0) + yScale(d.y1)) / 2})
        .text(function(d){
          let text, fill;
          if(state.slots[i].percentageMode === 'percent'){
            if(selectionBus.hasAnySelection()){
              text = `${(gs.select(`#sel_${d.key}`).datum().selValue * 100).toFixed(1)}%`
            }
            else text = `${(d.value*100).toFixed(1)}%`
          }else{
            if(selectionBus.hasAnySelection()) text = gs.select(`#sel_${d.key}`).datum().selValue
            else text = d.value
          }
          if(selectionBus.hasAnySelection()) fill = cScaleSel(gs.select(`#sel_${d.key}`).datum().selValue)
          else fill = cScale(d.value)
          d3.select(this).style('fill', isDark(fill) ? '#eee' : '#111')
          return text
        }).style('display', d => {if((xScaleGlobal(d.x1) - xScaleGlobal(d.x0)) < 30) return 'none'; return null}),
      update => update.text(function(d){
          let text, fill;
          if(state.slots[i].percentageMode === 'percent'){
            if(selectionBus.hasAnySelection()){
              text = `${(gs.select(`#sel_${d.key}`).datum().selValue * 100).toFixed(1)}%`
            }
            else text = `${(d.value*100).toFixed(1)}%`
          }else{
            if(selectionBus.hasAnySelection()) text = gs.select(`#sel_${d.key}`).datum().selValue
            else text = d.value
          }
          if(selectionBus.hasAnySelection()) fill = cScaleSel(gs.select(`#sel_${d.key}`).datum().selValue)
          else fill = cScale(d.value)
          d3.select(this).style('fill', isDark(fill) ? '#eee' : '#111')
          return text
        }),
      exit => exit.remove()
    )
  }

  return { drawLinkedOverlay };
}

// ---------- Global reusable 2D brush for heatmaps ----------
// It needs access to the current facet group, localSel, allCells, xScale/yScale, and chart index i
function makeHeatmapBrush({facet, go, xScale, yScale, allCells, facetW, facetH, i}){
  const brush2D = d3.brush().extent([[0, 0], [facetW, facetH]])
    .on('start', ({ selection, sourceEvent }) => {
      // detect plain click with no drag (brush start)
      if (sourceEvent && sourceEvent.type === 'mousedown') {
        // If there’s *no existing* selection rectangle drawn yet,
        // this is a click in empty space — clear selection.
        if (!selectionBus.isBrushing) {
          if(selectionBus.getLocal(i).size == 0) return
          selectionBus.clearLocal(i);
          facet.selectAll('rect.cell').classed('selected', false)
          const obj = {type: "clearSelection", chart: 'heatmap', slot: i, time: getFormatedTime(), userId: curUser.id}
          addLog(obj)
          hoverBegin = 0
        }
      }
      selectionBus.isBrushing = true;
    }).on('end', ({ selection }) => {
      // console.log("eeeeeeeeee")
      hoverBegin = 0
      selectionBus.isBrushing = false;
      $(go.node()).find('.overlay').css('pointer-events', 'none')
      if (!selection){
        return;
      }

      // localSel.clear()
      const [[x0, y0], [x1, y1]] = selection;
      // console.log(x0,x1,y0,y1)
      // Determine if scales are band (categorical) or linear (numerical)
      const isBandX = typeof xScale.bandwidth === 'function';
      const isBandY = typeof yScale.bandwidth === 'function';

      const brushedKeys = new Set(allCells.filter(c => {
          const cx0 = isBandX ? xScale(c.x) : xScale(c.x0);
          const cx1 = isBandX ? cx0 + xScale.bandwidth() : xScale(c.x1);
          const cy0 = isBandY ? yScale(c.y) : yScale(c.y1);
          const cy1 = isBandY ? cy0 + yScale.bandwidth() : yScale(c.y0);
          // note: for numeric y, yScale is inverted, so we check range overlap properly
          // console.log(cx0,cx1,c.key)
          return (
            cx1 >= x0 && cx0 <= x1 &&
            Math.min(cy0, cy1) <= y1 && Math.max(cy0, cy1) >= y0
          );
        }).map(c => c.key)
      );

      // Update cell visuals
      facet.selectAll('rect.cell').each(function(d){
        if(brushedKeys.has(d.key)) $(this).addClass('selected')
        else $(this).removeClass('selected')
      })

      // Compute IDs for selected cells
      const ids = allCells
        .filter(c => brushedKeys.has(c.key))
        .flatMap(c => c.ids);

      // Update this chart’s local selection and global AND intersection
      // console.log(brushedKeys)
      if (ids.length != 0){
        selectionBus.setLocal(i, ids);
        const obj = {type: "select", chart: 'heatmap', slot: i, ids: ids, cells: Array.from(brushedKeys), time: getFormatedTime(), userId: curUser.id}
        addLog(obj)
        hoverBegin = 0
      }

      // Clear brush overlay after use
      go.call(brush2D.move, null);
    });

  go.call(brush2D);

  //not to block tooltip of elements at the back layer
  facet.on('mousedown', function(event){
    // console.log('mouse down')
    if (event.synthetic) return;
    const brushOverlay = $(this).parent().parent().find('.overlay')
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
}
