// if both axes are numeric, draw scatterplot instead of heatmap
function drawScatter(slotEl, i, width, height) {
  const { x, y, xOuter, yOuter } = state.slots[i];
  const svg = d3.select(slotEl).select('svg');
  d3.select(slotEl).select('.opts').style('display', 'none');

  const data = state.data.filter(d =>
    d[x] != null && !isNaN(+d[x]) &&
    d[y] != null && !isNaN(+d[y])
  );
  if (!data.length) return;

  const { g, gx, gy, go, gs, gl, innerW, innerH, xLabel, yLabel }
        = baseAxes(svg, width, height, { left: 55, bottom: 55 });
  g.classed("scatterplot", true);

  const xExtent = d3.extent(data, d => +d[x]);
  const yExtent = d3.extent(data, d => +d[y]);
  const xScale = d3.scaleLinear().domain(xExtent).nice().range([0, innerW]);
  const yScale = d3.scaleLinear().domain(yExtent).nice().range([innerH, 0]);

  rotateTick(gx.call(d3.axisBottom(xScale)));
  gy.call(d3.axisLeft(yScale));
  xLabel.text(x);
  yLabel.text(y);

  g.append('rect').attr("x", 0)
    .attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .style("fill", "none")
    .style("pointer-events", "all");

  // draw points
  const pts = g.selectAll("circle.pt")
    .data(data, d => d.__id__)
    .join("circle")
      .attr("class", "pt")
      .attr("cx", d => xScale(+d[x]))
      .attr("cy", d => yScale(+d[y]))
      .attr("r", 3)
      .attr("fill", "steelblue")
      .attr("opacity", 0.7);

  const IdsSetLocal = selectionBus.getLocal(i)
  if(IdsSetLocal)
    pts.each(function(d){
      if(IdsSetLocal.has(d.__id__)) $(this).addClass('selected')
    })

  // 2D brush for scatterplot
  const brush = d3.brush().extent([[0, 0], [innerW, innerH]]).on('start', ({ selection, sourceEvent }) => {
    if (sourceEvent && sourceEvent.type === 'mousedown') {
      if (!selectionBus.isBrushing) {
        selectionBus.clearLocal(i);
        g.selectAll('circle.pt').classed('selected', false)
        const obj = {type: "clearSelection", chart: 'scatterplot', slot: i, time: getFormatedTime(), userId: curUser.id}
        addLog(obj)
        hoverBegin = 0
      }
    }
    selectionBus.isBrushing = true;
    // $(facet.node()).find('.brush .overlay').css('pointer-events', 'all')
  }).on("end", ({selection}) => {
    selectionBus.isBrushing = false;
    $(go.node()).find('.overlay').css('pointer-events', 'none')

    if (!selection){
      return; 
    }
    const [[x0, y0], [x1, y1]] = selection, ids = []

    g.selectAll('circle.pt').classed('selected', d => {
      const cx = xScale(+d[x]), cy = yScale(+d[y]);
      if(cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1){
        // console.log(d)
        ids.push(d.__id__)
        return true
      }
      return false
    })

    if (ids.length === 0) {
      selectionBus.clearLocal(i);  // removes this view’s constraint
    } else {
      selectionBus.setLocal(i, ids);
      const obj = {type: "select", chart: 'scatterplot', slot: i, ids: ids, time: getFormatedTime(), userId: curUser.id}
      addLog(obj)
    }
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

  // linked-selection overlay: highlight selected points with black outline
  function drawLinkedOverlay(sel) {
    const idSet = sel;
    // console.log(idSet)
    const layer = gs.selectAll('circle.sel').data(data.filter(d => idSet.has(d.__id__)), d => d.__id__);
    // console.log(data)
    layer.join(
      enter => enter.append('circle').attr('class','sel').attr('id', d => `sel_${d.__id__}`)
        .attr('cx', d => xScale(+d[x]))
        .attr('cy', d => yScale(+d[y]))
        .attr('r', 3)
        .attr('fill', "#FA2A55")
        .attr('opacity', 0)
        .transition().duration(1000).attr('opacity', 0.55),
      update => update.attr('opacity', 0.55),
      exit => exit.transition().duration(1000).attr('opacity', 0).remove()
    );

    g.selectAll('circle.pt').on('mouseenter', (event, d) => {
      let tip = `An ${tutorial ? 'instance': 'individual'} with ${x} ${(+d[x]).toLocaleString()} and ${y} ${(+d[y]).toLocaleString()}`
      if(selectionBus.hasAnySelection()) {
        const selRect = gs.select(`#sel_${d.__id__}`)
        if(!selRect.empty()){
          tip = `A selected ${tutorial ? 'instance': 'individual'} with ${x} ${(+d[x]).toLocaleString()} and ${y} ${(+d[y]).toLocaleString()}`;
        }
      }
      showTooltip(tip + '.', event.pageX, event.pageY)
      hoverBegin = getTime()
    }).on("mouseleave", function(event, d){
      $("#tooltip").css('visibility', "hidden")
      if(hoverBegin && getTime() - hoverBegin > 2000){
        const obj = {type: "hoverPoint", id: d.__id__, x: x, y: y, dx: d[x], dy: d[y], time: getFormatedTime(), userId: curUser.id}
        addLog(obj)
      }
      hoverBegin = 0
    })
  }  

  return { drawLinkedOverlay };
}
