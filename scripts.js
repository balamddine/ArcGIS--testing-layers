
$(function () {
    mainFunctions();

});
mainFunctions = async () => {

    modalLogic();
    mapInit();

}
mapInit = () => {
    const mapId = getMapId(); //"d795f2c57d774e77992ef27dd36aeba3" //;
    if (!mapId) {
        alert("Please provide a map id")
    }
    require([
        "esri/WebMap",
        "esri/views/MapView",
        "esri/symbols/support/symbolUtils",
        "esri/widgets/Fullscreen",
        "esri/widgets/BasemapGallery",
        "esri/widgets/Expand",
        "esri/Basemap"
    ], function (WebMap, MapView, symbolUtils, Fullscreen, BasemapGallery, Expand, Basemap) {
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
                    buttonEnabled: true
                },
                visibleElements: {
                    closeButton: true,
                    collapseButton: false,
                    heading: false,
                    actionBar: false
                }
            }
        });

        // add zoom button
        view.ui.move("zoom", "top-left");

        // add full screen button
        const container = document.getElementById("container");
        const fullscreen = new Fullscreen({
            view: view,
            element: container
        });
        view.ui.add(fullscreen, "top-left");

        // add Base map gallery
        const basemapGallery = new BasemapGallery({
            view: view,
            source: [
                // Default Topographic basemap
                Basemap.fromId("topo-vector"),

                // Esri Canada - Hybrid Image (id may vary depending on service)
                Basemap.fromId("hybrid"),

                // OpenStreetMap
                Basemap.fromId("osm")
            ]
        });
        const bgExpand = new Expand({
            view: view,
            content: basemapGallery,
            expandIcon: "basemap" // icon shown on expand button
        });
        view.ui.add(bgExpand, "top-left");

        // add howto text
        const howToButton = document.getElementById("btnHowTo")
        view.ui.add(howToButton, "top-left");


        webmap.when(async () => {
            const excel_data = await readExcelFromUrl();
            const layers = webmap.layers.items.slice().reverse();
            let i = 0;
            for (const layer of layers) {
                layer.popupEnabled = true;
                await addLayerAccordion(layer, symbolUtils, i, excel_data);
                i++;
            }


            setTimeout(() => { accordionInit() }, 1000);
            popupLogic(view);

        });

    });
}
getMapId = () => {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get("map_id");
    return mapId;
}
popupLogic = (view) => {
    view.on("click", async (event) => {
        const response = await view.hitTest(event);
        if (response && response.results.length) {

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
                const mapPoint = event.mapPoint;
                const attributes = feature.attributes;
                const content = createPopupContent(attributes) || "No data available...";
                view.popup.open({
                    title: layerName,
                    content: content,
                    location: mapPoint   // place popup at clicked map location
                });

            }

        }
    });

}
addLayerAccordion = async (layer, symbolUtils, index, excel_data) => {
    const container = document.querySelector("#accordion-container");
    const loader = document.querySelector("#loader");

    // Hide accordion and show loader
    if (container) container.style.display = "none";
    if (loader) loader.style.display = "flex";


    // --- Build accordion fresh ---
    const accordion__item = document.createElement("div");
    accordion__item.classList.add("accordion__item");

    const accordion__title = document.createElement("div");
    const cls = index == 0 ? (layer.visible ? " infrastructure visible" : "infrastructure notvisible") : (layer.visible ? "visible" : "notvisible")
    accordion__title.className = `accordion__title ${cls}`;

    const accordion__content = document.createElement("div");
    accordion__content.classList.add("accordion__content");

    const excelRow = excel_data.filter(row => row['Layer Group'] === layer.title);
    if (excelRow) {
        const accordion__content_parag = document.createElement("p");
        accordion__content_parag.textContent = transformHyperlink(excelRow[0].Description);
        accordion__content.appendChild(accordion__content_parag)
    }
    const ul = document.createElement("ul");

    // if (!layer.layers) {
    //     accordion__title.innerHTML = `<span class="accordion__title-text">${layer.title}</span>`;
    //     accordion__title.classList.add("no_expand")
    // }

    if (layer.type === "group" && layer.layers) {

        //accordion__title.classList.remove("no_expand");
        accordion__title.innerHTML = `<i class="fa fa-chevron-right toggle-down"></i><span class="accordion__title-text">${layer.title}</span>`;

        const toggleDiv = document.createElement("div");
        toggleDiv.className = "accordion-layer-toggle";
        toggleDiv.innerHTML = `<i class="${layer.visible ? "fa fa-eye" : "fa fa-eye-slash"}"></i>`;
        accordion__title.appendChild(toggleDiv);

        toggleDiv.addEventListener("click", () => {
            layer.visible = !layer.visible;
            const icon = toggleDiv.querySelector("i");
            icon.className = layer.visible ? "fa fa-eye" : "fa fa-eye-slash";
            const cls = index == 0 ? (layer.visible ? " infrastructure visible" : "infrastructure notvisible") : (layer.visible ? "visible" : "notvisible")
            accordion__title.className = `accordion__title ${cls}`;
        });

        const loadedSublayers = await Promise.all(
            layer.layers.map(s => s.load().then(() => s))
        );

        // if (loadedSublayers.length === 0) {
        //     accordion__title.innerHTML = `<span class="accordion__title-text">${layer.title}</span>`;
        //     accordion__title.classList.add("no_expand")
        // }
        if (layer.title != "Key Infrastructure") {
            for (const subLayer of loadedSublayers) {
                const li = document.createElement("li");
                li.className = "layer_item";

                const titleDiv = document.createElement("div");
                titleDiv.className = "layer_title";
                titleDiv.textContent = subLayer.title;

                const symbolDiv = document.createElement("div");
                symbolDiv.className = "layer-symbol";

                let symbol = subLayer.renderer?.symbol
                    || subLayer.renderer?.uniqueValueInfos?.[0]?.symbol
                    || subLayer.renderer?.classBreakInfos?.[0]?.symbol;

                if (symbol) {
                    const svgNode = await symbolUtils.renderPreviewHTML(symbol);
                    const msvg = svgNode?.querySelector("svg");
                    msvg ? svgToImg(msvg, symbolDiv) : symbolDiv.append(svgNode);
                }

                // const tooltip = document.querySelector("#tooltip");
                // const content = await get_layer_content(subLayer);
                // if (content) {
                //     titleDiv.addEventListener("mousemove", e => {
                //         tooltip.style.display = "block";
                //         tooltip.style.left = e.pageX + 10 + "px";
                //         tooltip.style.top = e.pageY + 10 + "px";
                //         tooltip.textContent = content;
                //     });
                //     titleDiv.addEventListener("mouseleave", () => {
                //         tooltip.style.display = "none";
                //     });
                // }
                const toggle_sublayerDiv = document.createElement("div");
                toggle_sublayerDiv.className = "sub-layer-toggle";
                toggle_sublayerDiv.innerHTML = `<i class="${subLayer.visible ? "fa fa-eye" : "fa fa-eye-slash"}"></i>`;


                toggle_sublayerDiv.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    subLayer.visible = !subLayer.visible;
                    const icon = toggle_sublayerDiv.querySelector("i");
                    icon.className = subLayer.visible ? "fa fa-eye" : "fa fa-eye-slash";
                });
                li.appendChild(symbolDiv);
                li.appendChild(titleDiv);
                li.appendChild(toggle_sublayerDiv);
                ul.appendChild(li);
            }
        }

    }

    accordion__content.appendChild(ul);
    accordion__item.appendChild(accordion__title);
    accordion__item.appendChild(accordion__content);
    container.appendChild(accordion__item);


    if (loader) loader.style.display = "none";
    if (container) container.style.display = "block";
}

accordionInit = () => {
    $(".accordion__title .toggle-down").on("click", function (e) {
        var $this = $(this).parent();

        // If it's a no_expand title, just return
        if ($this.hasClass("no_expand")) {
            return;
        }

        e.preventDefault();

        // Close other accordions if this one is not active
        if (!$this.hasClass("accordion-active")) {
            $(".accordion__content").slideUp(400);
            $(".accordion__title").removeClass("accordion-active");
            $(".accordion__title .toggle-down")
                .removeClass("fa-chevron-down")
                .addClass("fa-chevron-right");
        }

        // Toggle active class
        $this.toggleClass("accordion-active");

        // Toggle chevron icons
        const $icon = $(this);
        if ($this.hasClass("accordion-active")) {
            $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
        } else {
            $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
        }

        // Toggle content
        $this.next().slideToggle();
    });
}




// const get_layer_content = async (sublayer) => {

//     if (sublayer.type === "feature") {
//         const query = sublayer.createQuery();
//         query.where = "1=1"; // get all features
//         query.outFields = ["*"];// only return Content field

//         try {
//             const result = await sublayer.queryFeatures(query);

//             if (result.features.length > 0) {
//                 const featureWithContent = result.features.find(f =>
//                     f.attributes && f.attributes?.Content
//                 );
//                 return featureWithContent ? featureWithContent.attributes.Content || "" : ""
//             }
//         } catch (err) {
//             console.error(`Error querying sublayer ${sublayer.title}:`, err);
//             return ""
//         }
//     }

//     return ""; // if nothing found
// }

svgToImg = (svg, target) => {
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
        target.appendChild(img);
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
}


createPopupContent = (attributes) => {
    let content = ""
    if (attributes.hasOwnProperty("Content")) {
        content = `${transformHyperlink(attributes["Content"])} ${attributes.hasOwnProperty("Link") && attributes["Link"] ? `<div class='moreInfo'><strong>For more information refer to:</strong> ${attributes["Link"]}</div>` : ""}`

    }
    else {
        content = "<table class='esri-widget__table'>"
        for (const key in attributes) {
            if (attributes.hasOwnProperty(key) && key != "OBJECTID") {
                content += `<tr><th class='esri-feature-fields__field-header'>${key}</th><td class='esri-feature-fields__field-data'>${attributes[key]}</td></tr>`;

            }
        }
        content += "</table>";
    }
    return `<div class='popup-content'>${content}</div>`;

}

transformHyperlink = (content) => {
    let urlRegex = /(https?:\/\/[^\s]+)/g;
    // Replace URL with an anchor tag
    let transformed = content.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    return transformed
}
modalLogic = () => {

    const modal = document.getElementById("howToModal");
    const btn = document.getElementById("btnHowTo");
    const closeBtn = document.querySelector(".modal-close");

    // Open modal
    btn.addEventListener("click", () => {
        modal.style.display = "block";
    });

    // Close modal on X button
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Close modal on outside click
    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

}


loadJSON = async () => {
    try {
        const jsonFile = './config.json';
        const response = await fetch(jsonFile);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json(); // Parse JSON
        return data;

    } catch (error) {
        console.error('Error loading JSON:', error);
        return {}
    }
}




readExcelFromUrl = async () => {
    try {
        const config = await loadJSON();
        if (config) {
            const excel_link = config.excel_link; //"https://crhh.dvlpdigital.com/wp-content/uploads/2025/08/Map-Contents.xlsx";//
            const response = await fetch(excel_link);
            if (!response.ok) return [];

            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert sheet to JSON (array of objects with keys)
            const data = XLSX.utils.sheet_to_json(worksheet);
            return data;
        }
        return []
    } catch (error) {
        console.error(error);
    }
}