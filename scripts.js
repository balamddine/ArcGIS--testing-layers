
$(function () {
    accordionInit()
    mapInit()

});

accordionInit = () => {
    //BEGIN
    $(".accordion__title").on("click", function (e) {

        e.preventDefault();
        var $this = $(this);

        if (!$this.hasClass("accordion-active")) {
            $(".accordion__content").slideUp(400);
            $(".accordion__title").removeClass("accordion-active");
            $('.accordion__arrow').removeClass('accordion__rotate');
        }

        $this.toggleClass("accordion-active");
        $this.next().slideToggle();
        $('.accordion__arrow', this).toggleClass('accordion__rotate');
    });
    //END
}
mapInit = () => {

    require([
        "esri/WebMap",
        "esri/views/MapView",
        "esri/widgets/Legend",
        "esri/symbols/support/symbolUtils"
    ], function (WebMap, MapView, Legend, symbolUtils) {



        const webmap = new WebMap({
            portalItem: { id: "c8ae8f6c08d34492b00f939605e2a776" }
        });

        const view = new MapView({
            container: "viewDiv",
            map: webmap
        });
        view.on("pointer-move", async (event) => {
            const hit = await view.hitTest(event); // check what's under the pointer
            if (hit.results.length > 0) {
                const graphic = hit.results[0].graphic;
                view.container.style.cursor = graphic.layer ? "pointer" : "default";
            } else {
                view.container.style.cursor = "default";
            }
        });



        const tooltip = document.getElementById("tooltip");
        const viewDiv = document.getElementById("viewDiv");
        // Create a custom popup div
        const customPopup = document.createElement("div");
        customPopup.id = "customPopup";
        customPopup.className = "customPopup"
        customPopup.innerHTML = `<div class='popup_title'><span id="popupClose">✖</span></div><div id="popupContent" class='popup_content'></div>`;

        viewDiv.appendChild(customPopup);

        // Close popup when clicking the close button
        customPopup.querySelector("#popupClose").addEventListener("click", () => {
            customPopup.style.display = "none";
        });

        webmap.when(() => {
            const layers = webmap.layers.items;
            const layer_list_div = document.getElementById("layerList");

            layers.forEach(layer => {
                layer.popupEnabled = false;
                const layer_div = document.createElement("div");
                layer_div.className = "layer_item";

                const layer_title_div = document.createElement("div");
                layer_title_div.className = "layer_title";
                layer_title_div.textContent = layer.title;

                const layer_symbol_div = document.createElement("div");
                layer_symbol_div.className = "layer-symbol";


                layer_div.appendChild(layer_symbol_div);
                layer_div.appendChild(layer_title_div);


                layer_list_div.appendChild(layer_div);

                let symbol;
                if (layer.renderer?.symbol) {
                    symbol = layer.renderer.symbol;
                } else if (layer.renderer?.uniqueValueInfos) {
                    symbol = layer.renderer.uniqueValueInfos[0].symbol;
                } else if (layer.renderer?.classBreakInfos) {
                    symbol = layer.renderer.classBreakInfos[0].symbol;
                }

                if (symbol) {
                    symbolUtils.renderPreviewHTML(symbol).then((svgNode) => {
                        const msvg = svgNode.querySelector("svg")
                        svgToImg(msvg, layer_symbol_div);
                    });
                }

                layer_div.addEventListener("mousemove", (event) => {
                    tooltip.style.display = "block";
                    tooltip.style.left = event.pageX + 10 + "px";
                    tooltip.style.top = event.pageY + 10 + "px";
                    tooltip.textContent = `This is a simple tooltip for layer: ${layer.title}`;
                });
                layer_div.addEventListener("mouseleave", () => {
                    tooltip.style.display = "none";
                });
                layer_div.addEventListener("click", () => {
                    layer.visible = !layer.visible;
                });

                // const panel = document.createElement("div");
                // panel.className = "panel";

                // const toggleLink = document.createElement("div");
                // toggleLink.className = "layer-item";
                // toggleLink.textContent = layer.visible ? "Hide layer" : "Show layer";
                // toggleLink.onclick = () => {
                //     layer.visible = !layer.visible;
                //     toggleLink.textContent = layer.visible ? "Hide layer" : "Show layer";
                // };
                // panel.appendChild(toggleLink);

                // const zoomLink = document.createElement("div");
                // zoomLink.className = "layer-item";
                // zoomLink.textContent = "Zoom to layer";
                // zoomLink.onclick = () => {
                //     view.goTo(layer.fullExtent).catch(err => console.error(err));
                // };
                //panel.appendChild(zoomLink);

                //layerListDiv.appendChild(panel);

                // acc.addEventListener("click", function () {
                //     this.classList.toggle("active");
                //     panel.style.display = panel.style.display === "block" ? "none" : "block";
                // });
            });
        });

        // Custom popup logic using absolute div
        view.on("click", function (event) {
            view.hitTest(event).then(async function (response) {
                if (response.results.length) {

                    const graphic = response.results[0].graphic;
                    if (!graphic.layer) return;
                    const layer = graphic.layer;
                    const layerName = layer.title || "Layer";

                    const objectIdField = layer.objectIdField;
                    const objectId = graphic.attributes[objectIdField];

                    // Use queryFeatures to get all attributes for the objectId
                    const query = layer.createQuery();
                    query.objectIds = [objectId];
                    query.outFields = ["*"]; // This will return all fields
                    const attr_result = await layer.queryFeatures(query);
                    if (attr_result) {
                        const feature = attr_result.features[0];
                        const attributes = feature.attributes;
                         const tble = renderJSONAsTable(attributes)
                        view.popup.open({
                            title: "Feature Information",
                            location: event.mapPoint, // Position the pop-up at the click location
                            content: tble // Function to format the pop-up content
                        });


                       
                        // const content = `
                        //                 <h3 style="margin-top:0;">${layerName}</h3>
                        //                 ${tble}
                        //             `;
                        // // Set popup content
                        // customPopup.querySelector("#popupContent").innerHTML = content;
                    }


                    // const screenPoint = view.toScreen(event.mapPoint);
                    // // Get the position of the view container relative to the page
                    // const viewRect = view.container.getBoundingClientRect();
                    // // Calculate popup position relative to the container
                    // const padding = 10;
                    // let left = screenPoint.x + 20;
                    // let top = screenPoint.y + 20;

                    // // Adjust for view container position
                    // left += viewRect.left;
                    // top += viewRect.top;

                    // // Get popup size
                    // const popupRect = customPopup.getBoundingClientRect();

                    // // Prevent overflow within the view container
                    // if (left + popupRect.width + padding > viewRect.right) {
                    //     left = viewRect.right - popupRect.width - padding;
                    // }
                    // if (top + popupRect.height + padding > viewRect.bottom) {
                    //     top = viewRect.bottom - popupRect.height - padding;
                    // }
                    // if (left < viewRect.left + padding) {
                    //     left = viewRect.left + padding;
                    // }
                    // if (top < viewRect.top + padding) {
                    //     top = viewRect.top + padding;
                    // }

                    // // Apply position
                    // customPopup.style.left = left + "px";
                    // customPopup.style.top = top + "px";
                    // customPopup.style.display = "block";

                } else {
                    customPopup.style.display = "none";
                }
            });
        });

        // Hide popup when clicking elsewhere
        view.on("pointer-down", function (event) {
            view.hitTest(event).then(function (response) {
                if (!response.results.length) {
                    customPopup.style.display = "none";
                }
            });
        });

    });
}

svgToImg = (svg, target) => {
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
        target.appendChild(img);
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
}


renderJSONAsTable = (data) => {
    // create table
    const table = document.createElement("table");

    Object.entries(data).forEach(([key, value]) => {
        const row = document.createElement("tr");

        const keyCell = document.createElement("td");
        keyCell.textContent = key;

        const valueCell = document.createElement("td");
        valueCell.textContent = value;

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        table.appendChild(row);
    });

    const htmlString = table.outerHTML;
    table.remove(); // cleanup
    return htmlString;
}
