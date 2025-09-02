
$(function () {

    mainFunctions();

});
const mainFunctions = async () => {

    modalLogic();
    mapInit();

}

const mapInit = () => {
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
                dockEnabled: true,  // enable docking
                dockOptions: {
                    breakpoint: false // prevents automatic undocking at smaller viewports
                },
                visibleElements: {
                    closeButton: true,
                    collapseButton: false,
                    heading: true,
                    actionBar: false
                }
            }
        });
        const control_position = isMobile() ? "bottom-right" : "top-left"
        // add zoom button
        view.ui.move("zoom", control_position);

        // add full screen button
        const container = document.getElementById("container");
        const fullscreen = new Fullscreen({
            view: view,
            element: container
        });
        view.ui.add(fullscreen, control_position);

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
        view.ui.add(bgExpand, control_position);

        // add howto text
        const howToButton = document.getElementById("btnHowTo")
        view.ui.add(howToButton, control_position);


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

const getMapId = () => {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get("map_id");
    return mapId;
}

const popupLogic = (view) => {
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
                const popupTitle = createPopupTitle(attributes, layerName);
                const fields = layer.fields;
                const content = `${createPopupContent(attributes, fields)}` || "No data available...";
                view.popup.open({
                    title: popupTitle,
                    content: content,
                    location: mapPoint   // place popup at clicked map location
                });

            }

        }
    });

    view.on("pointer-move", async (event) => {
        const hitTest = await view.hitTest(event);
        const layerResults = hitTest.results.filter(r => r.graphic && r.graphic.layer);
        if (layerResults.length > 0) {
            // Mouse is over a feature -> show pointer
            view.container.style.cursor = "pointer";
        } else {
            // Default cursor
            view.container.style.cursor = "default";
        }
    });

}
const getLayerCssClass = (title) => {
    switch (title) {
        case "Key Infrastructure": return "infrastructure";
        case "Jurisdictions and Lands": return "jurisdictions";
        case "Facilities and Sites": return "facilities";
        case "Roads and Transport": return "roads";
        case "Power Generation": return "power";
        case "Pipelines and Powerlines": return "pipelines";
        case "Carbon Capture and Sequestration": return "sequestration";
        default: return ""
    }
}

const addLayerAccordion = async (layer, symbolUtils, index, excel_data) => {
    const container = document.querySelector("#accordion-container");
    const loader = document.querySelector("#loader");

    // Hide accordion and show loader
    if (container) container.style.display = "none";
    if (loader) loader.style.display = "flex";


    // --- Build accordion fresh ---
    const accordion__item = document.createElement("div");
    accordion__item.classList.add("accordion__item");

    const accordion__title = document.createElement("div");
    const layerClass = getLayerCssClass(layer.title)

    accordion__title.classList.add("accordion__title")
    accordion__title.classList.add(layerClass);
    if (layer.visible) {
        accordion__title.classList.remove("notvisible")
        accordion__title.classList.add("visible")
    }
    else {
        accordion__title.classList.remove("visible")
        accordion__title.classList.add("notvisible")
    }


    const accordion__content = document.createElement("div");
    accordion__content.classList.add("accordion__content");
    accordion__content.id = `layer-content_${layer.id}`
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
        let loadedSublayers = await Promise.all(
            layer.layers.map(s => s.load().then(() => s))
        );
        loadedSublayers = loadedSublayers.reverse();
        //accordion__title.classList.remove("no_expand");
        accordion__title.innerHTML = `<i class="fa fa-chevron-right"></i><span class="accordion__title-text">${layer.title}</span>`;

        const toggleDiv = document.createElement("div");
        toggleDiv.className = "accordion-layer-toggle";
        toggleDiv.title = "show/hide layer"
        toggleDiv.innerHTML = `<i class="${layer.visible ? "fa fa-eye" : "fa fa-eye-slash"}"></i>`;
        accordion__title.appendChild(toggleDiv);

        const toggle_labelDiv = document.createElement("div");
        toggle_labelDiv.className = "accordion-layer-toggle label_toggle";
        toggle_labelDiv.title = "show/hide layer labels"
        toggle_labelDiv.innerHTML = `<i class="${layer.visible ? "fa fa-tag" : "fa fa-tag-slash"}"></i>`;
        accordion__title.appendChild(toggle_labelDiv);





        toggleDiv.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            layer.visible = !layer.visible;
            const icon = toggleDiv.querySelector("i");
            icon.className = layer.visible ? "fa fa-eye" : "fa fa-eye-slash";
            accordion__title.classList.add("accordion__title")
            accordion__title.classList.add(layerClass);
            if (layer.visible) {
                accordion__title.classList.remove("notvisible")
                accordion__title.classList.add("visible")
            }
            else {
                accordion__title.classList.remove("visible")
                accordion__title.classList.add("notvisible")
            }



            for (const subLayer of loadedSublayers) {
                subLayer.visible = !subLayer.visible;
                const toggle_sublayerDiv = accordion__content.querySelector(`#sub-layer-toggle_${subLayer.id}`);
                if (!toggle_sublayerDiv) continue; // skip if not found
                const icon = toggle_sublayerDiv.querySelector("i");
                if (icon) {
                    icon.className = subLayer.visible ? "fa fa-eye" : "fa fa-eye-slash";
                }
            }

        });



        // if (loadedSublayers.length === 0) {
        //     accordion__title.innerHTML = `<span class="accordion__title-text">${layer.title}</span>`;
        //     accordion__title.classList.add("no_expand")
        // }
        // if (layer.title != "Key Infrastructure") {
        const is_keyInfra = layer.title == "Key Infrastructure"
        const labelClass = getLabelOption();

        for (const subLayer of loadedSublayers) {
            subLayer.labelingInfo = [labelClass];
            const li = document.createElement("li");
            li.className = `layer_item ${is_keyInfra ? "noMarg" : ""}`;
            const rowDiv = document.createElement("div");
            rowDiv.className = `layer_row ${is_keyInfra ? "hide" : ""}`;
            const titleDiv = document.createElement("div");
            titleDiv.className = "layer_title";


            const span_title = document.createElement("span");
            span_title.textContent = subLayer.title;
            span_title.title = subLayer.title;
            titleDiv.appendChild(span_title);
            rowDiv.appendChild(titleDiv);

            const toggle_sublayerDiv = document.createElement("div");
            toggle_sublayerDiv.id = `sub-layer-toggle_${subLayer.id}`
            toggle_sublayerDiv.className = "sub-layer-toggle";
            toggle_sublayerDiv.innerHTML = `<i class="${subLayer.visible ? "fa fa-eye" : "fa fa-eye-slash"}"></i>`;


            toggle_sublayerDiv.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                subLayer.visible = !subLayer.visible;
                const icon = toggle_sublayerDiv.querySelector("i");
                icon.className = subLayer.visible ? "fa fa-eye" : "fa fa-eye-slash";
            });

            rowDiv.appendChild(toggle_sublayerDiv);
            li.appendChild(rowDiv);


            const symbolsListDiv = await createSymbols(subLayer, titleDiv, symbolUtils, is_keyInfra)
            if (symbolsListDiv) {
                li.appendChild(symbolsListDiv);
            }


            ul.appendChild(li);
        }
        // }

    }

    accordion__content.appendChild(ul);
    accordion__item.appendChild(accordion__title);
    accordion__item.appendChild(accordion__content);
    container.appendChild(accordion__item);


    if (loader) loader.style.display = "none";
    if (container) container.style.display = "block";
}


const createSymbols = async (subLayer, titleDiv, symbolUtils, is_keyInfra) => {

    const renderer = subLayer.renderer;
    const symbolDiv = document.createElement("div");
    symbolDiv.className = "layer-symbol";
    symbolDiv.id = `symbolDiv_${subLayer.id}`;

    // preview symbol (first one)
    let previewSymbol = subLayer.renderer?.symbol
        || subLayer.renderer?.uniqueValueInfos?.[0]?.symbol
        || subLayer.renderer?.classBreakInfos?.[0]?.symbol;

    if (previewSymbol) {
        const svgNode = await symbolUtils.renderPreviewHTML(previewSymbol, { size: 20 });

        symbolDiv.append(svgNode);
    }
    titleDiv.append(symbolDiv)
    //header.append(symbolDiv, labelSpan);

    // --- Symbols List (hidden initially) ---
    const symbolsList = document.createElement("div");
    symbolsList.className = `legend-symbols ${is_keyInfra ? "show noMarg" : ""}`;

    let renderedInfoList = []
    if (renderer.type === "unique-value") {
        renderedInfoList = renderer.uniqueValueInfos
    }
    else if (renderer.type === "class-breaks") {
        renderedInfoList = renderer.classBreakInfos
    }
    renderedInfoList = renderedInfoList.reverse();
    if (renderedInfoList.length > 0) {
        symbolDiv.title = "Click to expand";
        symbolDiv.innerHTML = "";
        const chevron_icon = document.createElement("i");
        chevron_icon.classList.add("fa");
        chevron_icon.classList.add("fa-chevron-right");
        symbolDiv.append(chevron_icon);
        titleDiv.classList.add("chevron_exists")
        const hiddenValues = new Set();
        for (const info of renderedInfoList) {
            const item = document.createElement("div");
            item.className = "legend-symbol";

            const layer_symbolDiv = document.createElement("div");
            layer_symbolDiv.className = "layer-symbol";
            const svgNode = await symbolUtils.renderPreviewHTML(info.symbol, { size: 20 });
            layer_symbolDiv.append(svgNode);
            item.append(layer_symbolDiv);

            const span_text = document.createElement("span");
            span_text.textContent = info.label;
            span_text.title = info.label;
            item.append(span_text);


            // const symboltoggleDiv = document.createElement("div");
            // symboltoggleDiv.className = "symbol-layer-toggle";
            // symboltoggleDiv.title = "show/hide layer";
            // symboltoggleDiv.innerHTML = `<i class="fa fa-eye"></i>`;
            // item.append(symboltoggleDiv);

            // symbolsList.append(item);

            // // Click handler to hide/show only features with this value
            // symboltoggleDiv.addEventListener("click", () => {
            //     if (hiddenValues.has(info.value)) {
            //         hiddenValues.delete(info.value);
            //         symboltoggleDiv.innerHTML = `<i class="fa fa-eye"></i>`;
            //     } else {
            //         hiddenValues.add(info.value);
            //         symboltoggleDiv.innerHTML = `<i class="fa fa-eye-slash"></i>`;
            //     }

            //     // Build a definition expression excluding hidden values
            //     const where = hiddenValues.size > 0
            //         ? `${renderer.field} NOT IN ('${Array.from(hiddenValues).join("','")}')`
            //         : "1=1"; // show all if none hidden

            //     subLayer.definitionExpression = where;
            // });

            symbolsList.append(item);

        }
        titleDiv.addEventListener("click", (e) => {

            e.preventDefault();
            const $title = $(e.currentTarget);
            const $icon = $title.find("i")
            const $content = $title.parent().parent().find(".legend-symbols");


            if ($title.hasClass("accordion-active")) {
                // If already active, just close it
                $title.removeClass("accordion-active");
                $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
                $content.slideUp(400);
            } else {
                // Close all others first
                $(".legend-symbols").slideUp(400);
                $(".layer_title.chevron_exists").removeClass("accordion-active");
                $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");

                // Open the clicked one
                $title.addClass("accordion-active");
                $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
                $content.slideDown(400);
            }



            //symbolsList.classList.toggle("show");
        });
    }



    // if (renderer.type === "class-breaks") {
    //     for (const info of renderer.classBreakInfos) {
    //         const item = document.createElement("div");
    //         item.className = "legend-symbol";

    //         const svgNode = await symbolUtils.renderPreviewHTML(info.symbol, { size: 20 });
    //         item.append(svgNode);

    //         const text = document.createElement("span");
    //         text.textContent = info.label;
    //         item.append(text);

    //         symbolsList.append(item);
    //     }
    // }

    // if (renderer.type === "simple") {
    //     const item = document.createElement("div");
    //     item.className = "legend-symbol";

    //     const svgNode = await symbolUtils.renderPreviewHTML(renderer.symbol, { size: 20 });
    //     item.append(svgNode);

    //     const text = document.createElement("span");
    //     text.textContent = "All features";
    //     item.append(text);

    //     symbolsList.append(item);
    // }

    // --- Toggle behavior (click the svgDiv to expand) ---


    return symbolsList;
};

const getLabelOption = () => {
    return {
        // Define label placement
        labelPlacement: "above-center",
        // Label expression (what text to show)
        labelExpressionInfo: { expression: "$feature.Name" },
        symbol: {
            type: "text", // Label symbol type
            color: "black",
            haloColor: "white",
            haloSize: "2px",
            font: {
                size: "13px",
                weight: "bold"
            }
        }
    };
}

const accordionInit = () => {
    $(".accordion__title").on("click", function (e) {
        var $title = $(this);

        if ($title.hasClass("no_expand")) {
            return;
        }

        e.preventDefault();

        const $content = $title.next(".accordion__content");
        const $icon = $(this).find("i");

        if ($title.hasClass("accordion-active")) {
            // If already active, just close it
            $title.removeClass("accordion-active");
            $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
            $content.slideUp(400);
        } else {
            // Close all others first
            $(".accordion__content").slideUp(400);
            $(".accordion__title").removeClass("accordion-active");
            $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
            // Open the clicked one
            $title.addClass("accordion-active");
            $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
            $content.slideDown(400);
        }
    });
}

const createPopupTitle = (attributes, title) => {
    let mTitle = title;
    if (attributes.COMPLEX_NAME) mTitle = attributes.COMPLEX_NAME;
    else if (attributes.STATION) mTitle = attributes.STATION;
    else if (attributes.COMP_NAME) mTitle = attributes.COMP_NAME;
    else if (attributes.Name) mTitle = attributes.Name;
    else if (attributes.Display_Name) mTitle = attributes.Display_Name;


    return mTitle;
}

const createPopupContent = (attributes) => {
    let content = ""
    if (attributes.hasOwnProperty("Content")) {
        content = `${transformHyperlink(attributes["Content"])} ${attributes.hasOwnProperty("Link") && attributes["Link"] ? `<div class='moreInfo'><strong>For more information refer to:</strong> ${attributes["Link"]}</div>` : ""}`
    }
    else {

        content = "<table class='esri-widget__table'>"
        for (const key in attributes) {

            if (attributes.hasOwnProperty(key) && key != "OBJECTID") {
                const field = fields.find(f => f.name === key);
                const alias = field ? field.alias : key;
                content += `<tr><th class='esri-feature-fields__field-header'>${alias}</th><td class='esri-feature-fields__field-data'>${attributes[key]}</td></tr>`;

            }
        }
        content += "</table>";
    }
    return `<div class='popup-content'>${content}</div>`;

}

const transformHyperlink = (content) => {
    let urlRegex = /(https?:\/\/[^\s]+)/g;
    // Replace URL with an anchor tag
    let transformed = content.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    return transformed
}

const modalLogic = () => {

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

const loadJSON = async () => {
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

const readExcelFromUrl = async () => {
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

const isMobile = () => {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}