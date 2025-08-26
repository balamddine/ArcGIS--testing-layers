
$(function () {

    mapInit()

});

accordionInit = () => {
    //BEGIN
    $(".accordion__title .toggle-down").on("click", function (e) {
        var $this = $(this).parent();

        // If it's a no_expand title, just return or handle differently
        if ($this.hasClass("no_expand")) {
            // Optional: do something special for no_expand titles
            return; // stops accordion behavior
        }

        e.preventDefault();

        if (!$this.hasClass("accordion-active")) {
            $(".accordion__content").slideUp(400);
            $(".accordion__title").removeClass("accordion-active");
        }

        $this.toggleClass("accordion-active");
        $this.next().slideToggle();
    });
    //END
}
getMapId = () => {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get("map_id");
    return mapId;
}
mapInit = () => {
    const mapId = getMapId(); //"750c8bc463aa4678981087ee08c62c06"//"331d866c026b49e78a8d5ce244d25816" //;
    if (!mapId) {
        alert("Please provide a map id")
    }
    require([
        "esri/WebMap",
        "esri/views/MapView",
        "esri/widgets/Legend",
        "esri/symbols/support/symbolUtils"
    ], function (WebMap, MapView, Legend, symbolUtils) {
        const webmap = new WebMap({
            portalItem: { id: mapId }
            //portalItem: { id: "c8ae8f6c08d34492b00f939605e2a776" }
        });

        const view = new MapView({
            container: "viewDiv",
            map: webmap,
            popup: {
                dockEnabled: true,
                dockOptions: {
                    buttonEnabled: false
                },
                visibleElements: {
                    closeButton: false,
                    collapseButton: false,
                    heading: false,
                    actionBar: false
                }
            }
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






        webmap.when(async () => {
            const layers = webmap.layers.items;
            const layer_list_div = document.getElementById("layerList");
            for (const layer of layers) {
                layer.popupEnabled = false;
                //if (layer.visible)
                await addLayerAccordion(layer, symbolUtils)
            };
            setTimeout(() => {
                accordionInit()
            }, 1000)
        });

        // Custom popup logic using absolute div
        view.on("click", function (event) {
            view.hitTest(event).then(async function (response) {
                if (response.results.length) {

                    const graphic = response.results[0].graphic;
                    if (!graphic.layer) return;
                    const layer = graphic.layer;
                    const layerName = layer.title || "";

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
                        const content = createPopupContent(attributes) || "No data available...";

                        view.popup.open({
                            title: layerName,
                            location: event.mapPoint, // Position the pop-up at the click location
                            content: content, // Function to format the pop-up content
                            className: "my-custom-popup"
                        });
                    }

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


addLayerAccordion = async (layer, symbolUtils) => {
    const container = document.querySelector("#accordion-container");
    const loader = document.querySelector("#loader");

    // Hide accordion container and show loader
    if (container) container.style.display = "none";
    if (loader) loader.style.display = "flex";

    const accordion__item = document.createElement("div");
    accordion__item.classList.add("accordion__item");

    const accordion__title = document.createElement("div");
    accordion__title.classList.add("accordion__title");

    const accordion__content = document.createElement("div");
    accordion__content.classList.add("accordion__content");

    const ul = document.createElement("ul");
    if (!layer.layers) {
        accordion__title.innerHTML = `<span class="accordion__title-text">${layer.title}</span>`;
        accordion__title.classList.add("no_expand")
    }
    if (layer.type === "group" && layer.layers) {
        accordion__title.classList.remove("no_expand")
        accordion__title.innerHTML = `<i class="fa-solid fa-chevron-down toggle-down"></i><span class="accordion__title-text">${layer.title}</span>`;
        const layer_accordion__title_div = document.createElement("div");
        layer_accordion__title_div.className = "accordion-layer-toggle";
        layer_accordion__title_div.innerHTML = `<i class="fa fa-eye"></i>`
        accordion__title.appendChild(layer_accordion__title_div)

        const layer_accordion_content_div = document.createElement("div");
        layer_accordion_content_div.className = "accordion-layer-content";
        layer_accordion_content_div.innerHTML = ``
        accordion__title.appendChild(layer_accordion_content_div)

        layer_accordion__title_div.addEventListener("click", () => {
            layer.visible = !layer.visible;

            // Toggle Font Awesome classes
            const icon = layer_accordion__title_div.querySelector("i"); // assuming <i class="fa fa-eye"></i>
            if (layer.visible) {
                icon.classList.remove("fa-eye-slash");
                icon.classList.add("fa-eye");
            } else {
                icon.classList.remove("fa-eye");
                icon.classList.add("fa-eye-slash");
            }
        });
        // Load all sublayers in parallel
        const loadedSublayers = await Promise.all(
            layer.layers
                .filter(subLayer => subLayer.visible)  // only visible sublayers
                .map(subLayer => subLayer.load().then(() => subLayer))
        );
        if (loadedSublayers && loadedSublayers.length == 0) {
            accordion__title.innerHTML = `<span class="accordion__title-text">${layer.title}</span>`;
            accordion__title.classList.add("no_expand")
        }
        for (const subLayer of loadedSublayers) {
            const li = document.createElement("li");
            li.className = "layer_item";

            // li.addEventListener("click", () => {
            //     subLayer.visible = !subLayer.visible;
            // });

            const layer_title_div = document.createElement("div");
            layer_title_div.className = "layer_title";
            layer_title_div.textContent = subLayer.title;

            const layer_symbol_div = document.createElement("div");
            layer_symbol_div.className = "layer-symbol";







            let symbol;
            if (subLayer.renderer?.symbol) {
                symbol = subLayer.renderer.symbol;
            } else if (subLayer.renderer?.uniqueValueInfos) {
                symbol = subLayer.renderer.uniqueValueInfos[0].symbol;
            } else if (subLayer.renderer?.classBreakInfos) {
                symbol = subLayer.renderer.classBreakInfos[0].symbol;
            }

            if (symbol) {
                const svgNode = await symbolUtils.renderPreviewHTML(symbol);
                if (svgNode) {
                    const msvg = svgNode.querySelector("svg");
                    if (msvg) svgToImg(msvg, layer_symbol_div);
                    else layer_symbol_div.append(svgNode);
                }
            }
            const layer_tooltip_div = document.querySelector("#tooltip");
            const content_attribute = await get_layer_content(subLayer)
            if (content_attribute) {
                layer_title_div.addEventListener("mousemove", (event) => {
                    layer_tooltip_div.style.display = "block";
                    layer_tooltip_div.style.left = event.pageX + 10 + "px";
                    layer_tooltip_div.style.top = event.pageY + 10 + "px";
                    layer_tooltip_div.textContent = content_attribute;
                });
                layer_title_div.addEventListener("mouseleave", () => {
                    layer_tooltip_div.style.display = "none";
                });
            }

            li.appendChild(layer_symbol_div);
            li.appendChild(layer_title_div);
            ul.appendChild(li);
        }
    }

    accordion__content.appendChild(ul);
    accordion__item.appendChild(accordion__title);
    accordion__item.appendChild(accordion__content);
    container.appendChild(accordion__item);

    // Hide loader and show accordion container
    if (loader) loader.style.display = "none";
    if (container) container.style.display = "block";
};
const get_layer_content = async (sublayer) => {

    if (sublayer.type === "feature") {
        const query = sublayer.createQuery();
        query.where = "1=1"; // get all features
        query.outFields = ["*"];// only return Content field

        try {
            const result = await sublayer.queryFeatures(query);

            if (result.features.length > 0) {
                const featureWithContent = result.features.find(f =>
                    f.attributes && f.attributes?.Content
                );
                return featureWithContent ? featureWithContent.attributes.Content || "" : ""
            }
        } catch (err) {
            console.error(`Error querying sublayer ${sublayer.title}:`, err);
            return ""
        }
    }

    return ""; // if nothing found
}

listLayers = (layer, depth = 0) => {
    console.log(" ".repeat(depth * 2) + `Layer: ${layer.title} (type: ${layer.type})`);

    if (layer.type === "group" && layer.layers) {
        layer.layers.forEach(subLayer => listLayers(subLayer, depth + 1));
    }
}

svgToImg = (svg, target) => {
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
        target.appendChild(img);
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
}


createPopupContent = (attributes) => {

    if (attributes.hasOwnProperty("Content")) {
        return `<div class='popup-header'></div><div class='popup-content'>${attributes["Content"]}</div>`
    }
    // let content = "";
    // for (const key in attributes) {
    //     if (attributes.hasOwnProperty(key)) {
    //         if(key.toLowerCase()=="content"){
    //             content = `<tr><td><b>${key}</b></td><td>${attributes[key]}</td></tr>`;
    //         }

    //     }
    // }
    // content += "</table>";
    //return content;
}
