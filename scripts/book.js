$(document).ready(function() {
  var jsonPath = "json/" + location.hash.split('#')[1] + ".json";
  var context;

  var publicTree;
  var running = 1; // number of running asynchronous functions
  
  function parseTree (tree, replace) {
    if (typeof replace != "undefined") {
      replace.children = tree.children;
      parseTree(tree);
    } else if (tree.source) {
      running++;
      $.getJSON(tree.source, function(treeData) {
        running--;
        parseTree(treeData, tree)
      });
    } else if (tree.children) {
      $(tree.children).each(function(){
        parseTree(this)
      });
    }
  }

  $.getJSON(jsonPath, function(treeData) {
    publicTree = treeData;
    parseTree(publicTree);
    running--;
  });


  function checkIfDone(){
    if (running > 0)
      setTimeout(checkIfDone,100);
    else
      drawTree(publicTree);
  }
  checkIfDone();


  function drawTree(data) {
    context = data;

    $("h1").html("The " + data.name.split(' ').pop() + " Family");

    var source   = $("#person-template").html();
    Handlebars.registerPartial("person", $("#person-template").html());
    var template = Handlebars.compile(source);
    var html     = template(context);
    $("#tree").html(html);

    $(".person").on("click", "img, .expand", function(e) {
      $(this).siblings(".child").slideToggle();

      // If you want to keep the bios hidden until clicked
      // $(this).siblings(".name-and-bio").find(".bio").slideToggle();

      if ($(this).hasClass("expand"))
        $(this).fadeToggle();
      else
        $(this).siblings(".expand").fadeToggle();
      e.stopPropagation();
    });
  };
});
