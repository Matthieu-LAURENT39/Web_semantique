// ========== Constants and config ==========
const LANGUAGE_INFO = {
    'en': { name: 'English', emoji: '🇬🇧' },
    'fr': { name: 'Français', emoji: '🇫🇷' },
    'es': { name: 'Español', emoji: '🇪🇸' },
    'de': { name: 'Deutsch', emoji: '🇩🇪' },
    'ru': { name: 'Русский', emoji: '🇷🇺' },
    'ja': { name: '日本語', emoji: '🇯🇵' }
};

const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// ========== Utility functions ==========
function kelvinToCelsius(k) {
    return k !== null ? (k - 273.15).toFixed(2) : null;
}

function tempToPercent(temp) {
    if (temp === null) return null;
    const minTemp = 0;   // 0 Kelvin
    const maxTemp = 500; // 500 Kelvin
    return Math.max(0, Math.min(100, ((temp - minTemp) / (maxTemp - minTemp)) * 100));
}

// ========== Query builders ==========
function buildDBPediaQuery(planetName) {
    // Properly encode the DBpedia resource URI
    const encodedResource = `<http://dbpedia.org/resource/${planetName}>`;

    return `
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX dbp: <http://dbpedia.org/property/>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?label ?abstract ?maxTemp ?meanTemp ?minTemp ?averageSpeed ?density ?surfaceArea ?volume ?wikidataId
               (GROUP_CONCAT(DISTINCT ?satellite; SEPARATOR="|") as ?satellites)
               (GROUP_CONCAT(DISTINCT ?parentBody; SEPARATOR="|") as ?parentBodies)
        WHERE {
            VALUES ?planet { ${encodedResource} }
            ?planet dbo:abstract ?abstract ;
                    owl:sameAs ?wikidataId .
            FILTER(CONTAINS(STR(?wikidataId), "wikidata.org"))
            OPTIONAL { ?planet dbo:maximumTemperature ?maxTemp }
            OPTIONAL { ?planet dbo:meanTemperature ?meanTemp }
            OPTIONAL { ?planet dbo:minimumTemperature ?minTemp }
            OPTIONAL { ?planet dbo:averageSpeed ?averageSpeed }
            OPTIONAL { ?planet dbo:density ?density }
            OPTIONAL { ?planet dbo:surfaceArea ?surfaceArea }
            OPTIONAL { ?planet dbo:volume ?volume }
            OPTIONAL { 
                {
                    ?satellite dbp:satelliteOf ?planet 
                } UNION {
                    ?planet ^dbp:satelliteOf ?satellite
                }
            }
            OPTIONAL { 
                {
                    ?planet dbp:satelliteOf ?parentBody 
                } UNION {
                    ?planet dbo:orbits ?parentBody
                } UNION {
                    ?planet dbp:orbits ?parentBody
                }
            }
            FILTER (lang(?abstract) = "en")
        } 
        GROUP BY ?label ?abstract ?maxTemp ?meanTemp ?minTemp ?averageSpeed ?density ?surfaceArea ?volume ?wikidataId
        LIMIT 1
    `;
}

function buildWikidataLabelsQuery(wikidataId) {
    return `
        SELECT ?label ?langCode WHERE {
            VALUES ?entity { wd:${wikidataId} }
            VALUES ?langCode { "en" "fr" "es" "de" "ru" "ja" }
            ?entity rdfs:label ?label .
            FILTER(LANG(?label) = ?langCode)
        }
        ORDER BY ?langCode
    `;
}

function buildAtmosphereQuery(wikidataId) {
    return `
        SELECT DISTINCT ?atmosphere ?atmosphereLabel ?material ?materialLabel ?proportion 
               ?radius ?radiusUnit ?radiusUnitLabel ?appliesTo ?appliesToLabel
        WHERE {
            OPTIONAL {
                # instance of (P31)
                # part of (P361) 
                ?atmosphere p:P31 ?statement0;
                           p:P361 ?statement1.
                # atmosphere of a planet (Q19704068)
                # subclass of (P279), allow for multiple levels of subclassing
                ?statement0 (ps:P31/(wdt:P279*)) wd:Q19704068.
                ?statement1 (ps:P361/(wdt:P279*)) wd:${wikidataId}.
                
                OPTIONAL {
                    ?atmosphere p:P186 ?materialStatement.
                    ?materialStatement ps:P186 ?material;
                                     pq:P1107 ?proportion.
                }
            }
            
            OPTIONAL {
                wd:${wikidataId} p:P2120 ?radiusStatement.
                ?radiusStatement ps:P2120 ?radius;
                                psv:P2120 ?radiusValue.
                ?radiusValue wikibase:quantityUnit ?radiusUnit.
                OPTIONAL {
                    ?radiusStatement pq:P518 ?appliesTo.
                }
            }
            
            SERVICE wikibase:label { 
                bd:serviceParam wikibase:language "en".
                ?atmosphere rdfs:label ?atmosphereLabel.
                ?material rdfs:label ?materialLabel.
                ?radiusUnit rdfs:label ?radiusUnitLabel.
                ?appliesTo rdfs:label ?appliesToLabel.
            }
        }
        GROUP BY ?atmosphere ?atmosphereLabel ?material ?materialLabel ?proportion 
                 ?radius ?radiusUnit ?radiusUnitLabel ?appliesTo ?appliesToLabel
        ORDER BY DESC(?proportion)
    `;
}

function buildRadiusQuery(wikidataId) {
    return `
        SELECT ?radius ?radiusUnit ?radiusUnitLabel ?appliesTo ?appliesToLabel
        WHERE {
            wd:${wikidataId} p:P2120 ?radiusStatement.
            ?radiusStatement ps:P2120 ?radius;
                            psv:P2120 ?radiusValue.
            ?radiusValue wikibase:quantityUnit ?radiusUnit.
            OPTIONAL {
                ?radiusStatement pq:P518 ?appliesTo.
            }
            
            SERVICE wikibase:label { 
                bd:serviceParam wikibase:language "en".
                ?radiusUnit rdfs:label ?radiusUnitLabel.
                ?appliesTo rdfs:label ?appliesToLabel.
            }
        }
    `;
}

// ========== Data fetching functions ==========
async function fetchSPARQLData(endpoint, query, headers = {}) {
    const prefix = endpoint.includes('dbpedia') ? LOG_PREFIX.DBPEDIA : LOG_PREFIX.WIKIDATA;
    const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;

    try {
        console.log(`${prefix} Requesting: ${url.substring(0, 150)}...`);
        const response = await fetch(url, { headers });

        if (!response.ok) {
            console.error(`${prefix} HTTP Error:`, response.status, response.statusText);
        }

        const text = await response.text();
        if (!text.trim().startsWith('{')) {
            console.error(`${prefix} Invalid JSON response:`, text);
        }

        return JSON.parse(text);
    } catch (error) {
        console.error(`${prefix} ${error.name}:`, error.message);
        throw error;
    }
}

async function fetchWikipediaImage(planetName) {
    const prefix = LOG_PREFIX.WIKIPEDIA;
    try {
        const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${planetName}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        console.log(`${prefix} Fetching image for: ${planetName}`);

        const response = await fetch(wikiApiUrl);
        if (!response.ok) {
            console.error(`${prefix} Failed to fetch image:`, response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pages[pageId].thumbnail) {
            return pages[pageId].thumbnail.source;
        }
        console.log(`${prefix} No image found for: ${planetName}`);
        return null;
    } catch (error) {
        console.error(`${prefix} ${error.name}:`, error.message);
        return null;
    }
}

async function fetchPlanetData(planetName, targetPrefix) {
    console.log("Fetching data for planet:", planetName);
    const query = buildDBPediaQuery(planetName);
    console.log("Generated DBPedia query:", query);

    if (targetPrefix === 'planet') {
        window.wikiImagePromise = fetchWikipediaImage(planetName);
    }

    try {
        const data = await fetchSPARQLData(DBPEDIA_ENDPOINT, query);
        console.log("DBPedia response:", data);
        const results = data.results.bindings[0];

        if (!results) {
            console.error(`${prefix} No data found for: ${planetName}`);
            throw new Error('No data found');
        }

        const wikidataId = results.wikidataId?.value.split('/').pop();
        console.log(`${prefix} Found Wikidata ID: ${wikidataId}`);

        if (wikidataId) {
            if (targetPrefix === 'planet') {
                await fetchAndDisplayWikidataInfo(wikidataId);
            }
            // Fetch radius data for both planet and Earth
            await fetchAndDisplayRadiusInfo(wikidataId, targetPrefix);
        }

        return processDBPediaResults(results, planetName, targetPrefix);
    } catch (error) {
        console.error(`${LOG_PREFIX.ERROR} Failed to fetch planet data:`, error.message);
        throw error;
    }
}

async function fetchAndDisplayWikidataInfo(wikidataId) {
    const prefix = LOG_PREFIX.WIKIDATA;
    console.log(`${prefix} Fetching additional data for ID: ${wikidataId}`);

    const headers = {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'PlanetInfoViewer/1.0'
    };

    try {
        // Fetch and display labels
        const labelsData = await fetchSPARQLData(
            WIKIDATA_ENDPOINT,
            buildWikidataLabelsQuery(wikidataId),
            headers
        );
        displayLanguageLabels(labelsData.results.bindings);

        // Fetch and display atmosphere
        const atmosphereData = await fetchSPARQLData(
            WIKIDATA_ENDPOINT,
            buildAtmosphereQuery(wikidataId),
            headers
        );
        displayAtmosphereData(atmosphereData.results.bindings);
    } catch (error) {
        console.error(`${prefix} Failed to fetch additional data:`, error.message);
    }
}

async function fetchAndDisplayRadiusInfo(wikidataId, targetPrefix) {
    const headers = {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'PlanetInfoViewer/1.0'
    };

    try {
        const radiusData = await fetchSPARQLData(
            WIKIDATA_ENDPOINT,
            buildRadiusQuery(wikidataId),
            headers
        );
        displayRadiusData(radiusData.results.bindings, targetPrefix);
    } catch (error) {
        console.error("Error fetching radius data:", error);
    }
}

// ========== Data processing functions ==========
function processDBPediaResults(results, planetName, targetPrefix) {
    const processedData = {
        label: results.label?.value || planetName,
        abstract: results.abstract?.value || "No description available.",
        temperatures: {
            max: results.maxTemp ? Math.round(parseFloat(results.maxTemp.value)) : null,
            mean: results.meanTemp ? Math.round(parseFloat(results.meanTemp.value)) : null,
            min: results.minTemp ? Math.round(parseFloat(results.minTemp.value)) : null
        },
        physicalProperties: {
            averageSpeed: results.averageSpeed ? parseFloat(results.averageSpeed.value) : null,
            density: results.density ? parseFloat(results.density.value) : null,
            surfaceArea: results.surfaceArea ? parseFloat(results.surfaceArea.value) : null,
            volume: results.volume ? parseFloat(results.volume.value) : null
        },
        satellites: processSatellites(results.satellites?.value),
        parentBodies: processSatellites(results.parentBodies?.value),
        externalLinks: {
            dbpedia: `http://dbpedia.org/resource/${planetName}`,
            wikidata: results.wikidataId?.value,
            wikipedia: `https://en.wikipedia.org/wiki/${planetName}`
        }
    };

    // Store data for comparison
    if (targetPrefix === 'planet') {
        window.planetData = processedData.physicalProperties;
        window.planetLabel = processedData.label;
    } else if (targetPrefix === 'earth') {
        window.earthData = processedData.physicalProperties;
    }

    return processedData;
}

function processSatellites(satellitesString) {
    if (!satellitesString) return [];
    return satellitesString.split('|')
        .map(url => url.replace('http://dbpedia.org/resource/', '').replace(/_/g, ' '))
        .filter(name => name.trim() !== '');
}

// ========== Display functions ==========
function displayLanguageLabels(labels) {
    if (labels.length === 0) return;

    const labelMap = labels.reduce((acc, curr) => {
        acc[curr.langCode.value] = curr.label.value;
        return acc;
    }, {});

    const nameDiv = document.getElementById("planet-name");
    if (!nameDiv) return;

    const languageSection = `
        <div class="flex flex-wrap justify-center gap-4 text-lg mt-6">
            ${Object.entries(labelMap).map(([lang, name]) => `
                <div class="glass rounded-xl px-6 py-3 flex items-center gap-4">
                    <span class="text-3xl" role="img" aria-label="${LANGUAGE_INFO[lang].name} flag">
                        ${LANGUAGE_INFO[lang].emoji}
                    </span>
                    <div>
                        <div class="font-medium text-xl text-gray-200">${name}</div>
                        <div class="text-sm text-gray-400">${LANGUAGE_INFO[lang].name}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    nameDiv.insertAdjacentHTML('afterend', languageSection);
}

function processRadiusData(results) {
    const radiusData = {};

    for (const result of results) {
        if (result.radius && result.appliesTo) {
            const type = result.appliesTo.value;
            const value = parseFloat(result.radius.value);
            const unit = result.radiusUnitLabel?.value || 'km';
            const label = result.appliesToLabel?.value || '';

            // Map to radius types
            if (type.includes('Q2796622')) {
                radiusData.mean = { value, unit, label: 'Mean Radius' };
            } else if (type.includes('Q23538')) {
                radiusData.equatorial = { value, unit, label: 'Equatorial Radius' };
            } else if (type.includes('Q28809093') || type.includes('Q183273')) {
                // Handle both ways of specifying polar radius
                radiusData.polar = { value, unit, label: 'Polar Radius' };
            }
        }
    }

    return radiusData;
}
function displayAtmosphereData(atmosphereResults) {
    const atmosphereSection = document.createElement('div');
    atmosphereSection.className = 'glass rounded-xl p-6 mb-6';
    atmosphereSection.innerHTML = generateAtmosphereHTML(atmosphereResults);

    const temperatureSection = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.gap-6.mb-6');
    if (temperatureSection) {
        temperatureSection.parentNode.insertBefore(atmosphereSection, temperatureSection);
    }
}

function generateAtmosphereHTML(atmosphereResults) {
    const hasComposition = atmosphereResults && atmosphereResults.some(r => r.proportion && r.materialLabel);

    return `
        <h2 class="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Atmosphere Composition</h2>
        <div class="space-y-4">
            ${hasComposition ? `
                <div class="relative h-8 bg-white/5 rounded-lg overflow-hidden">
                    ${generateAtmosphereBarSegments(atmosphereResults)}
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    ${generateAtmosphereLegend(atmosphereResults)}
                </div>
            ` : `
                <div class="glass rounded-xl p-4">
                    <div class="flex items-center gap-2 text-gray-400">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p>Atmospheric composition data is not available in the database.</p>
                    </div>
                    <p class="mt-2 text-sm text-gray-500">This could be because the celestial body has no significant atmosphere or because the data hasn't been added to Wikidata yet.</p>
                </div>
            `}
        </div>
    `;
}

function generateAtmosphereBarSegments(results) {
    // Create a Set to track unique materials and store processed segments
    const seen = new Set();
    const segments = [];
    let cumulativePercentage = 0;

    // First pass: collect unique materials and their proportions
    results
        .filter(r => r.proportion && r.materialLabel)
        .forEach(r => {
            const material = r.materialLabel.value;
            if (!seen.has(material)) {
                seen.add(material);
                const percentage = parseFloat(r.proportion.value) * 100;
                segments.push({
                    material,
                    percentage,
                    left: cumulativePercentage
                });
                cumulativePercentage += percentage;
            }
        });

    // Generate the HTML for each segment
    return segments.map((segment, index) => {
        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-indigo-500'];
        return `
            <div class="${colors[index % colors.length]} h-full absolute"
                 style="left: ${segment.left}%; width: ${segment.percentage}%">
            </div>
        `;
    }).join('');
}

function generateAtmosphereLegend(results) {
    // Create a Set to track unique materials
    const seen = new Set();

    return results
        .filter(r => r.proportion && r.materialLabel)
        .filter(r => {
            // Only keep the first occurrence of each material
            const material = r.materialLabel.value;
            if (seen.has(material)) return false;
            seen.add(material);
            return true;
        })
        .map((r, index) => {
            const colors = ['text-blue-500', 'text-emerald-500', 'text-amber-500', 'text-rose-500', 'text-purple-500', 'text-indigo-500'];
            return `
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full ${colors[index % colors.length].replace('text-', 'bg-')}"></div>
                    <div>
                        <div class="font-medium text-gray-200">${r.materialLabel.value}</div>
                        <div class="text-sm text-gray-400">${(parseFloat(r.proportion.value) * 100).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        }).join('');
}

function getRadiusForDisplay(radiusData) {
    // Get equatorial and polar radius, fallback to mean radius if either is missing
    let equatorial = radiusData.equatorial?.value;
    let polar = radiusData.polar?.value;

    if (!equatorial || !polar) {
        if (radiusData.mean?.value) {
            equatorial = radiusData.mean.value;
            polar = radiusData.mean.value;
        } else {
            return null;
        }
    }

    return { equatorial, polar, unit: radiusData.equatorial?.unit || radiusData.polar?.unit || radiusData.mean?.unit || 'km' };
}

function createSizeComparison(planetRadius, earthRadius) {
    if (!planetRadius || !earthRadius) return '';

    // Use the larger planet's equatorial radius to set the scale
    const maxRadius = Math.max(planetRadius.equatorial, earthRadius.equatorial);
    const scale = 150 / maxRadius; // Scale to fit in 150px

    // Calculate scaled dimensions
    const planetWidth = planetRadius.equatorial * scale;
    const planetHeight = planetRadius.polar * scale;
    const earthWidth = earthRadius.equatorial * scale;
    const earthHeight = earthRadius.polar * scale;

    // Calculate ratio between planets
    const sizeRatio = (planetRadius.equatorial / earthRadius.equatorial).toFixed(2);

    return `
        <div class="mt-8 text-center">
            <style>
                .planet-ellipse {
                    transition: transform 0.3s ease-out;
                }
                .planet-group:hover .selected-planet {
                    transform: translateX(200px);
                }
                .planet-group:hover .earth {
                    transform: translateX(-200px);
                }
                .planet-label {
                    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                    opacity: 0.7;
                }
                .planet-group:hover .planet-label {
                    opacity: 1;
                }
                .planet-group:hover .selected-planet-label {
                    transform: translateX(200px);
                }
                .planet-group:hover .earth-label {
                    transform: translateX(-200px);
                }
            </style>
            <div class="relative inline-block planet-group" style="width: 800px; height: 350px;">
                <svg width="800" height="400" class="absolute top-0 left-0">
                    <!-- Planet ellipse -->
                    <g class="planet-ellipse selected-planet">
                        <ellipse cx="400" cy="200" rx="${planetWidth}" ry="${planetHeight}"
                                class="fill-cyan-500/20 stroke-cyan-500" stroke-width="2"/>
                    </g>
                    <!-- Earth ellipse -->
                    <g class="planet-ellipse earth">
                        <ellipse cx="400" cy="200" rx="${earthWidth}" ry="${earthHeight}"
                                class="fill-blue-500/20 stroke-blue-500" stroke-width="2" stroke-dasharray="4"/>
                    </g>
                    <!-- Labels -->
                    <text x="400" y="${200 - planetHeight - 20}" text-anchor="middle" 
                          class="fill-cyan-500 planet-label selected-planet-label">Selected Planet</text>
                    <text x="400" y="${200 - earthHeight - 20}" text-anchor="middle" 
                          class="fill-blue-500 planet-label earth-label">Earth</text>
                </svg>
            </div>
            <p class="text-gray-300 mt-4">
                Size comparison (solid: selected planet, dashed: Earth)
                <br>
                <span class="text-sm text-gray-400">(Hover to separate)</span>
            </p>
            <p class="text-gray-300 mt-2 text-xl font-bold">
                Selected planet is ${sizeRatio}× the size of Earth at the equator
            </p>
        </div>
    `;
}

function displayRadiusData(results, targetPrefix) {
    const radiusData = processRadiusData(results);

    // Update the planet name in the header if this is the planet data
    if (targetPrefix === 'planet') {
        window.planetRadiusData = getRadiusForDisplay(radiusData);
    } else {
        window.earthRadiusData = getRadiusForDisplay(radiusData);
    }

    // Only display the data for the selected planet
    if (targetPrefix === 'planet') {
        // Update the appropriate column
        const container = document.getElementById(`${targetPrefix}-radius-info`);
        if (!container) {
            console.error("Radius data container not found:", targetPrefix);
            return
        }

        // Update the content
        const content = Object.entries(radiusData).length > 0 ? `
        <div class="glass rounded-xl p-4">
            <div class="grid grid-cols-1 md:grid-cols-${Object.entries(radiusData).length} gap-4">
            ${Object.entries(radiusData).map(([type, data]) => `
                <div>
                <div class="text-gray-300">${data.label}</div>
                <div class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    ${data.value.toLocaleString()} ${data.unit}
                </div>
                </div>
            `).join('')}
            </div>
        </div>
        ` : `
        <div class="glass rounded-xl p-4">
            <p class="text-gray-500 italic">No radius data available</p>
        </div>
        `;

        container.innerHTML = content;
    }

    // After both planet and Earth data are loaded, create the size comparison
    if (window.planetRadiusData && window.earthRadiusData) {
        const comparisonContainer = document.getElementById('radius-comparison');
        if (comparisonContainer) {
            comparisonContainer.innerHTML = createSizeComparison(window.planetRadiusData, window.earthRadiusData);
        }
    }
}

// ========== Display functions for comparison table ==========
function updateComparisonTable() {
    if (!window.planetData || !window.earthData) return;

    const properties = {
        averageSpeed: {
            label: "Average Speed",
            unit: "m/s",
            format: value => value ? value.toLocaleString() : null
        },
        density: {
            label: "Density",
            unit: "kg/m³",
            format: value => value ? value.toLocaleString() : null
        },
        surfaceArea: {
            label: "Surface Area",
            unit: "km²",
            format: value => value ? value.toLocaleString() : null
        },
        volume: {
            label: "Volume",
            unit: "km³",
            format: value => value ? value.toLocaleString() : null
        }
    };

    const tableBody = document.getElementById("comparison-table");
    if (!tableBody) return;

    const planetName = window.planetLabel || document.getElementById("planet-table-header").textContent;
    const isEarth = planetName.toLowerCase() === 'earth';

    // Update the table header with the proper label
    document.getElementById("planet-table-header").textContent = planetName;

    tableBody.innerHTML = Object.entries(properties).map(([key, prop]) => {
        const planetValue = prop.format(window.planetData[key]);
        const earthValue = prop.format(window.earthData[key]);

        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-2 font-medium">${prop.label} (${prop.unit})</td>
                <td class="px-4 py-2">${planetValue !== null ? planetValue : '<span class="text-gray-600 italic">Data missing</span>'}</td>
                <td class="px-4 py-2">${isEarth ? 'Selected plannet is already earth' :
                (earthValue !== null ? earthValue : '<span class="text-gray-600 italic">Data missing</span>')}</td>
            </tr>
        `;
    }).join('');
}

function generateExternalLinksHTML(externalLinks) {
    return `
        <div class="flex flex-wrap gap-4 mt-4">
            <a href="${externalLinks.wikipedia}" target="_blank" rel="noopener noreferrer" 
               class="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .084-.103.135-.2.157-.74.108-.835.361-.492 1.005.646 1.212 3.636 7.254 4.172 8.286.406-.614 1.612-3.095 2.202-4.53.473-1.156.402-1.704-.699-1.875-.19-.029-.243-.134-.243-.213v-.434L10.3 4.128h4.147l.037.046v.434c0 .084-.103.135-.2.157-.776.108-.835.361-.505 1.005.646 1.212 2.839 5.728 3.136 6.39.784-1.577 2.384-5.042 2.779-6.075.209-.556.117-.745-.505-.852-.097-.022-.2-.073-.2-.157v-.434l.037-.046h3.546l.052.046v.434c0 .084-.104.135-.2.157-1.664.242-1.454.77-2.583 3.317-.718 1.627-3.419 7.075-3.839 7.915-.853 1.727-1.534 1.61-2.292-.181-.621-1.47-1.968-4.016-2.839-5.728z"/>
                </svg>
                Wikipedia
            </a>
            <a href="${externalLinks.dbpedia}" target="_blank" rel="noopener noreferrer" 
               class="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.523 0-10-4.477-10-10S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm1-10.414V15h-2v-4.414l-2.293 2.293-1.414-1.414L12 6.758l4.707 4.707-1.414 1.414L13 11.586z"/>
                </svg>
                DBpedia
            </a>
            <a href="${externalLinks.wikidata}" target="_blank" rel="noopener noreferrer" 
               class="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.6 14.8l-.6.6-1.2-.6-.6-1.3-.4-1.5c-.8-.2-1.6-.4-2.4-.5l-.3-1.5.3-1.2.8-.8 1.2-.6 1.4-.1c.8.2 1.6.4 2.4.5l.3 1.5-.3 1.2-.8.8-1.2.6-1.4.1c-.2.8-.4 1.6-.5 2.4l.5 1.3zm3.8-4.3l-.6.6-1.2-.6-.6-1.3-.4-1.5c-.8-.2-1.6-.4-2.4-.5l-.3-1.5.3-1.2.8-.8 1.2-.6 1.4-.1c.8.2 1.6.4 2.4.5l.3 1.5-.3 1.2-.8.8-1.2.6-1.4.1c-.2.8-.4 1.6-.5 2.4l.5 1.3zm3.8-4.3l-.6.6-1.2-.6-.6-1.3-.4-1.5c-.8-.2-1.6-.4-2.4-.5l-.3-1.5.3-1.2.8-.8 1.2-.6 1.4-.1c.8.2 1.6.4 2.4.5l.3 1.5-.3 1.2-.8.8-1.2.6-1.4.1c-.2.8-.4 1.6-.5 2.4l.5 1.3z"/>
                </svg>
                Wikidata
            </a>
        </div>
    `;
}

// Export functions for use in planet.html
window.PlanetData = {
    fetchPlanetData,
    kelvinToCelsius,
    tempToPercent,
    updateComparisonTable,
    fetchWikipediaImage,
    fetchAndDisplayRadiusInfo
}; 