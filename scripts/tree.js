var jsonPath = "json/" + location.hash.split('#')[1] + ".json";

var publicTree;
var running = 1; // number of running asynchronous functions

function parseTree (tree, replace) {
  if (typeof replace != "undefined") {
    replace.children = tree.children;
    parseTree(tree);
  } else if (tree.source) {
    running++;
    d3.json(tree.source, function(error, treeData) {
      running--;
      parseTree(treeData, tree);
    });
  } else if (tree.children) {
    $(tree.children).each(function(){
      parseTree(this);
    });
  }
}

d3.json(jsonPath, function(error, treeData) {
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

function drawTree(treeData) {

    var vertical = false;

    // Calculate total nodes, max label length
    var totalNodes = 0;
    var maxLabelLength = 0;
    // panning variables
    var panSpeed = 200;
    var panBoundary = 20; // Within 20px from edges will pan when dragging.
    // Misc. variables
    var i = 0;
    var duration = 750;
    var root;
    var maxDepth = 0;

    // size of the diagram
    var viewerWidth = $(document).width();
    var viewerHeight = $(document).height();
     
    var tree = d3.layout.tree().size([viewerHeight, viewerWidth]);

    // define a d3 diagonal projection for use by the node paths later on.
    var diagonal = d3.svg.diagonal().projection(function(d) {
      if (vertical)
        return [d.x, d.y];
      else
        return [d.y, d.x];
    });

    function englishName (d) {
      return d["english-name"] ? d["english-name"] : d.name;
    }

    // A recursive helper function for performing some setup by walking through all nodes
    function visit(parent, visitFn, childrenFn) {
      if (!parent) return;
      visitFn(parent);
      var children = childrenFn(parent);
      if (children) {
        var count = children.length;
        for (var i = 0; i < count; i++)
          visit(children[i], visitFn, childrenFn);
      }
    }

    // Call visit function to establish maxLabelLength
    visit(treeData, function(d) {
      totalNodes++;
      maxLabelLength = Math.max(englishName(d).length, maxLabelLength);
    }, function(d) {
      return d.children && d.children.length > 0 ? d.children : null;
    });

    // TODO: Pan function, can be better implemented.
    function pan(domNode, direction) {
        var speed = panSpeed;
        if (panTimer) {
            clearTimeout(panTimer);
            translateCoords = d3.transform(svgGroup.attr("transform"));
            if (direction == 'left' || direction == 'right') {
                translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                translateY = translateCoords.translate[1];
            } else if (direction == 'up' || direction == 'down') {
                translateX = translateCoords.translate[0];
                translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
            }
            scaleX = translateCoords.scale[0];
            scaleY = translateCoords.scale[1];
            scale = zoomListener.scale();
            svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
            d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
            zoomListener.scale(zoomListener.scale());
            zoomListener.translate([translateX, translateY]);
            panTimer = setTimeout(function() {
                pan(domNode, speed, direction);
            }, 50);
        }
    }

    // Define the zoom function for the zoomable tree
    function zoom() {
      svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .call(zoomListener);


    // Helper functions for collapsing and expanding nodes.

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    function expand(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(expand);
            d._children = null;
        }
    }

    var overCircle = function(d) {
        selectedNode = d;
        updateTempConnector();
    };
    var outCircle = function(d) {
        selectedNode = null;
        updateTempConnector();
    };

	function clickChildren(d) {
		if (d3.event.defaultPrevented) return; // click suppressed
		d = toggleChildren(d);
		update(d);
    };

    function centerNode(source) {
        scale = zoomListener.scale();
        x = -source.y0;
        y = -source.x0;
        x = x * scale + viewerWidth / 2;
        y = y * scale + viewerHeight / 2;
        d3.select('g').transition()
            .duration(duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
        //zoomListener.scale(scale);
        zoomListener.translate([x, y]);
    }

    // Toggle children function
    function toggleChildren(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        return d;
    }

    // Toggle children on click.
    function clickPerson(d) {
        if (d3.event.defaultPrevented) return; // click suppressed
        //d = toggleChildren(d);
        //update(d);
        centerNode(d);
    }

    function update(source) {
        // Compute the new height, function counts total children of root node and sets tree height accordingly.
        // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
        // This makes the layout more consistent.
        var levelWidth = [1];
        var childCount = function(level, n) {

            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function(d) {
                    childCount(level + 1, d);
                });
            }
        };
        childCount(0, root);
        var newHeight = d3.max(levelWidth) * 70; // 70 pixels per line  
        tree = tree.size([newHeight, viewerWidth]);

        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse(),
            links = tree.links(nodes);

        // Set widths between levels based on maxLabelLength.
        nodes.forEach(function(d) {
          if (d.depth > maxDepth)
            maxDepth = d.depth;
          if (vertical)
            d.y = (d.depth * (maxLabelLength * 5)); 
          else
            d.y = (d.depth * (maxLabelLength * 8)); 
        });

        // Update the nodes…
        node = svgGroup.selectAll("g.node")
                       .data(nodes, function(d) {
                         return d.id || (d.id = ++i);
                       });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) {
                if (vertical)
                  return "translate(" + source.x0 + "," + source.y0 + ")";
                else
                  return "translate(" + source.y0 + "," + source.x0 + ")";
            })
			.on('click', clickPerson);

        nodeEnter.append("circle")
			.attr("r", 10)
			.attr('class', 'childrenCircle')
			.on("click", clickChildren);

        if (vertical) {
          nodeEnter.append("text")
            .attr("y", function(d) { 
             return d.children || d._children ? -18 : 18; })
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(function(d) { return englishName(d); })
            .style("fill-opacity", 1);
        } else {
          nodeEnter.append("text")
              .attr("x", function(d) {
                return -20;
              })
              .attr("dy", ".35em")
              .attr('class', 'nodeText')
              .attr("text-anchor", function(d) {
                return "end";
              })
              .text(function(d) {
                return englishName(d);
              })
              .style("fill-opacity", 0);
        }

        // append an image if one exists
        nodeEnter.append("image")
                 .attr('title', '')
                 .attr("xlink:href", "")
                 .attr("x", -13)
                 .attr("y", -13)
                 .attr("width", 25)
                 .attr("height", 25);

        node.select('image').attr("xlink:href", function(d) {
          if (d.image)
            return d.image;
          else if (d.isFemale)
            return "images/placeholder-female.png";
          else
            return "images/placeholder.png";
        });
        node.select('image').attr("title", function(d) {
          return "<strong>" + englishName(d) + "</strong>. " + (d.bio ? d.bio : "");
        });

        // Update the text to reflect whether node has children or not.
        node.select('text')
            .attr("x", function(d) {
                //return d.children || d._children ? -10 : 10;
                return -20;
            })
            .attr("text-anchor", function(d) {
                //return d.children || d._children ? "end" : "start";
                return "end";
            })
            .text(function(d) {
                return englishName(d);
            });

        // Change the circle fill depending on whether it has children and is collapsed
		node.select("circle.childrenCircle")
            .attr("class", function(d) {
				if (d.children)
					return "childrenCircle children__visible";

				if (d._children)
					return "childrenCircle children__collapsed";

				return "childrenCircle noChildren";
            });

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                if (vertical)
                  return "translate(" + d.x + "," + d.y + ")";
                else
                  return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text").style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                if (vertical)
                  return "translate(" + source.x + "," + source.y + ")";
                else
                  return "translate(" + source.y + "," + source.x + ")";
            }).remove();

        nodeExit.select("circle").attr("r", 0);

        nodeExit.select("text").style("fill-opacity", 0);

        // Update the links…
        var link = svgGroup.selectAll("path.link").data(links, function(d) { return d.target.id; });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .style('stroke-width', function(d) {return 3*(maxDepth - d.source.depth) + 'px';})
            .attr("d", function(d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });

        // Transition links to their new position.
        link.transition().duration(duration).attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    var svgGroup = baseSvg.append("g");

    // Define the root
    root = treeData;
    root.x0 = viewerHeight / 2;
    root.y0 = 0;

    // Layout the tree initially and center on the root node.
    update(root);
    centerNode(root);

    // Show biography and picture on hover
    $("body").hoverIntent({
      over: function() {
        var bio = $(this).attr("title");
        var img = $(this).attr("href");
        $("#bio").html("<img src='"+ $(this).attr("href") + "'>" + bio)
                 .addClass("has-image")
                 .fadeIn("fast");
      },
      out: function() {
        $("#bio").fadeOut("fast");
      },
      selector: ".node image"
    });
};
