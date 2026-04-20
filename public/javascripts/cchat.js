Ui.prototype.executeMessage = async function(){
  const headers = { "Content-Type": "application/json" };
  const response = await fetch('chatapi', {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      messages: curMessages,
      id: curUser.id,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Server error:", errText);
    // progressCallback("Error: failed to reach server.");
    return;
  }

  // Parse JSON response
  const data = await response.json();

  // Extract assistant reply
  const assistantMessage =
    data?.data?.choices?.[0]?.message?.content || "No response";

  // Send final result to UI
  curMessages.push({role: "assistant", content: ""})
  this.updateChat()
  curMessages[curMessages.length-1].content = assistantMessage

  const obj = {type: "botResponse", content: assistantMessage, time: getFormatedTime(), userId: curUser.id}
  addLog(obj)

  await showText('', assistantMessage, $("#innerMessageDiv > :last-child"))

  $('#messageDiv').animate({ scrollTop: $('#innerMessageDiv').height() }, 1000);
  // document.getElementById("messageDiv").scrollTop = $("#innerMessageDiv").scrollHeight;

    // progressCallback(assistantMessage);

  // (responseObj) => {
  //     $("#innerMessageDiv > :last-child").html(md.render(responseObj.content || ""));
  //   }

  // var leftoverString = ""
  // if (response.status !== 200) {
  //   throw new Error(await response.text());
  // }

  // const reader = response.body.getReader();
  // // console.log(reader)
  // let responseObj = {content: ""};
  // for (;;) {
  //   const { done, value } = await reader.read();
  //   if (done) break;
  //   let lines = new TextDecoder("utf-8").decode(value)//.split("\n\n");
  //   lines = (leftoverString + lines).split("\n\n");
  //   var lastLine = lines[lines.length - 1]
  //   console.log(lastLine)
  //   if(!lastLine.includes("[DONE]") && !lastLine.endsWith("}]}")){
  //     leftoverString = lastLine
  //     lines.splice(-1)
  //   } else leftoverString = ""
  //   console.log(leftoverString)
  //   // console.log(lines[0])
  //   // console.log(lines[lines.length - 1])

  //   for (const line of lines) {
  //     console.log(line)
  //     if (line.startsWith("data: ")) {
  //       if (line.includes("[DONE]")){
  //         curMessages[curMessages.length - 1].content = responseObj.content
  //         const obj = {type: "answer", answer: responseObj.content, time: getFormatedTime(), userId: curUser.id}
  //         addLog(obj)
  //         return responseObj;
  //       }
  //       try {
  //         const data = JSON.parse(line.slice(6));
  //         // console.log(data)
  //         const delta = data.choices[0].delta;
  //         // console.log(delta)
  //         for (const key in delta) {
  //           if (!(key in responseObj)) responseObj[key] = delta[key];
  //           else responseObj[key] += delta[key];
  //           // console.log(JSON.stringify(responseObj))
  //           progressCallback(responseObj);
  //         }
  //       } catch (e) {
  //         console.log(e)
  //         console.log("Error parsing line:", JSON.stringify(line));
  //       }
  //     }
  //   }
  // }
  // curMessages[curMessages.length - 1].content = responseObj.content
 
  // return responseObj;
}

function messageEnter(ele){
  if(event.key === "Enter"){
    curUi.assessMessage(ele)
  }
}

Ui.prototype.assessMessage = async function(ele){
  if(this.loading || ele.value.trim().length == 0) return
  const message = ele.value;
  
  // ev.target.blur();
  curMessages.push({role: "user", content: ele.value})
  // curMessages.push({role: "assistant", content: ""})
  this.updateChat()
  // if(this.executeMessage(message)){
  const obj = {type: "sendQuery", query: ele.value, time: getFormatedTime(), userId: curUser.id}
  addLog(obj)
  ele.value = "";

  this.executeMessage()
  // }
}

Ui.prototype.updateChat = function(){
  const self = this
  var messageData = d3.select("#innerMessageDiv").selectAll(".messageGroup").data(curMessages, function(d){return curMessages.indexOf(d)})
  messageData.exit().remove()

  var messageEnter = messageData.enter().append("div").attrs({
    class: function(d){
      if(d.role == "user") return "messageGroup user"; 
      // else if(d.role == "kg") return "messageGroup assistant kg"
      return "messageGroup assistant"
    },
  }).styles({
    padding: "0 10px",
    // 'margin-bottom': '5px',
    'border-radius': '5px',
    "background-color": function(d){
      if(d.role == "assistant") return "#eee"
      // else if(d.role == "author") return useColors[d.paperID]
    }
  })

  messageEnter.each(function(d){
    if(d.role == "assistant"){
      d3.select(this).on("mouseenter", function(){
        hoverBegin = getTime()
      }).on("mouseleave", function(event, da){
        if(hoverBegin && getTime() - hoverBegin > 2000){
          const obj = {type: "hoverBotAnswer", content: da.content, time: getFormatedTime(), userId: curUser.id}
          addLog(obj)
        }
        hoverBegin = 0
      })
      // if(add) await showText(self.moIcon.replace('<svg ', `<svg width="40" height="40" fill="#000000" `), d.label, $(this))
      d3.select(this).html(md.render(d.content))
    }else if(d.role == "user"){
      var div = d3.select(this)
      d3.select(this).on("mouseenter", function(){
        hoverBegin = getTime()
      }).on("mouseleave", function(event, da){
        if(hoverBegin && getTime() - hoverBegin > 2000){
          const obj = {type: "hoverQuery", content: da.content, time: getFormatedTime(), userId: curUser.id}
          addLog(obj)
        }
        hoverBegin = 0
      })
      self.updateUserMessage(div, d)
    }
  })

  messageData = messageEnter.merge(messageData)

  $('#messageDiv').animate({ scrollTop: $('#innerMessageDiv').height() }, 1000);

}

Ui.prototype.updateUserMessage = function(div, d){
  const self = this
  div.append("div").attrs({
    class: "markdown"
  }).styles({
    display: "flex"
  }).append("div").html(md.render(d.content))

  div.append("textarea").attrs({
    oninput: 'this.style.height = "";this.style.height = this.scrollHeight + "px"',
    // "type": "text",
    class: "editTextbox editEle",//"text ui-widget-content ui-corner-all"
  })
  div.append("input").attrs({
    "type": "button",
    value: "Send",
    class: "editButton editEle"
  }).on("click", function(){
    const paDiv = d3.select(this.parentNode)
    const newTe = paDiv.select("textarea").property('value')
    if(self.loading || newTe.trim().length == 0) return
    const ind = curMessages.indexOf(d3.select(this.parentNode).data()[0])
    // if(mark == "main"){
    curMessages.splice(ind)
    curMessages.push({role: "user", content: newTe})
    // curMessages.push({role: "assistant", content: ""})
    self.updateChat()
    self.executeMessage()
  
    paDiv.selectAll(".editEle").style("display", "none")
    paDiv.select(".markdown").style("display", "flex")
    paDiv.style("background-color", "transparent")
    const obj = {type: "sendEditedQuery", query: newTe, time: getFormatedTime(), userId: curUser.id}
    addLog(obj)
    hoverBegin = 0
  })//.on("mouseenter", function(){
  //   hoverBegin = getTime()
  // }).on("mouseleave", function(event, d){
  //   if(hoverBegin && getTime() - hoverBegin > 3000){
  //     const obj = {type: "hoverSendQueryEdit", time: getFormatedTime(), userId: curUser.id}
  //     addLog(obj)
  //   }
  //   hoverBegin = 0
  // })
  div.append("input").attrs({
    "type": "button",
    value: "Cancel",
    class: "editButton editEle"
  }).on("click", function(){
    var paDiv = d3.select(this.parentNode)
    // var tex = paDiv.data()[0].content
    // paDiv.html("")
    // paDiv.append("p").text(tex).
    paDiv.selectAll(".editEle").style("display", "none")
    paDiv.select(".markdown").style("display", "flex")
    paDiv.style("background-color", "transparent")
    const obj = {type: "cancelQueryEdit", time: getFormatedTime(), userId: curUser.id}
    addLog(obj)
  })
  div.selectAll(".editEle").style("display", "none")
  // d3.select(this).select("p").data([d.content])
  div.select(".markdown").append("i").text(" \uf304").attrs({
    class: "awesome"
  }).on("click", function(){
    var paDiv = d3.select(this.parentNode)
    var te = paDiv.data()[0].content
    // console.log(te)
    div.select(".markdown").style("display", "none")
    div.styles({
      // "background-color": "#aaa",
    })
    div.selectAll(".editEle").style("display", null)
    div.select("textarea").property('value', te).each(function() {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    }).node().focus()
    const obj = {type: "EditQuery", query: te, time: getFormatedTime(), userId: curUser.id}
    addLog(obj)
    hoverBegin = 0
  }).styles({
    padding: "5px",
    "padding-top": "10px"
  })//.on("mouseenter", function(){
    //hoverBegin = getTime()
  //}).on("mouseleave", function(event, d){
    //if(hoverBegin && getTime() - hoverBegin > 3000){
      //const obj = {type: "hoverEditQuery", time: getFormatedTime(), userId: curUser.id}
      //addLog(obj)
    //}
    //hoverBegin = 0
  //})
}