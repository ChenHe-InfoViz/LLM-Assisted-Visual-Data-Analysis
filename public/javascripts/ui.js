Ui = function(){
  const self = this

  this.loading = false

  $("#sendButton").on("click", function(){
    self.assessMessage(document.getElementById("input-box"))
  })

  $('#taskIcon').on("click", function(){
    window.open("../vis/tutorial", "_blank");
  })
}

