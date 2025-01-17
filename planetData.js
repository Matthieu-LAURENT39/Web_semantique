// Constants and configurations
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

const LOG_PREFIX = {
    DBPEDIA: '[DBPedia]',
    WIKIDATA: '[Wikidata]',
    WIKIPEDIA: '[Wikipedia]',
    ERROR: '[ERROR]'
};

// Utility functions
function kelvinToCelsius(k) {
    return k !== null ? (k - 273.15).toFixed(2) : null;
}

function tempToPercent(temp) {
    if (temp === null) return null;
    const minTemp = 0;   // 0 Kelvin
    const maxTemp = 500; // 500 Kelvin
    return Math.max(0, Math.min(100, ((temp - minTemp) / (maxTemp - minTemp)) * 100));
}

// Query builders
function buildDBPediaQuery(encodedPlanetName) {
    // Properly encode special characters for SPARQL
    const sparqlSafeName = encodedPlanetName.replace(/[()]/g, '\\$&');

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
            dbr:${sparqlSafeName} rdfs:label ?label ;
                                    dbo:abstract ?abstract ;
                                    owl:sameAs ?wikidataId .
            FILTER(CONTAINS(STR(?wikidataId), "wikidata.org"))
            FILTER(LANG(?label) = "en")
            OPTIONAL { dbr:${sparqlSafeName} dbo:maximumTemperature ?maxTemp }
            OPTIONAL { dbr:${sparqlSafeName} dbo:meanTemperature ?meanTemp }
            OPTIONAL { dbr:${sparqlSafeName} dbo:minimumTemperature ?minTemp }
            OPTIONAL { dbr:${sparqlSafeName} dbo:averageSpeed ?averageSpeed }
            OPTIONAL { dbr:${sparqlSafeName} dbo:density ?density }
            OPTIONAL { dbr:${sparqlSafeName} dbo:surfaceArea ?surfaceArea }
            OPTIONAL { dbr:${sparqlSafeName} dbo:volume ?volume }
            OPTIONAL { 
                {
                    ?satellite dbp:satelliteOf dbr:${sparqlSafeName} 
                } UNION {
                    dbr:${sparqlSafeName} ^dbp:satelliteOf ?satellite
                }
            }
            OPTIONAL { dbr:${sparqlSafeName} dbp:satelliteOf ?parentBody }
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
        SELECT ?atmosphere ?atmosphereLabel ?material ?materialLabel ?proportion WHERE {
            ?atmosphere p:P31 ?statement0;
                       p:P361 ?statement1.
            ?statement0 (ps:P31/(wdt:P279*)) wd:Q19704068.
            ?statement1 (ps:P361/(wdt:P279*)) wd:${wikidataId}.
            
            OPTIONAL {
                ?atmosphere p:P186 ?materialStatement.
                ?materialStatement ps:P186 ?material;
                                 pq:P1107 ?proportion.
            }
            
            SERVICE wikibase:label { 
                bd:serviceParam wikibase:language "en".
                ?atmosphere rdfs:label ?atmosphereLabel.
                ?material rdfs:label ?materialLabel.
            }
        }
        ORDER BY DESC(?proportion)
    `;
}

// Data fetching functions
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
    const prefix = LOG_PREFIX.DBPEDIA;
    console.log(`${prefix} Fetching data for: ${planetName} (${targetPrefix})`);

    const encodedPlanetName = planetName.replace(/ /g, '_');
    const query = buildDBPediaQuery(encodedPlanetName);

    if (targetPrefix === 'planet') {
        window.wikiImagePromise = fetchWikipediaImage(planetName);
    }

    try {
        const data = await fetchSPARQLData(DBPEDIA_ENDPOINT, query);
        const results = data.results.bindings[0];

        if (!results) {
            console.error(`${prefix} No data found for: ${planetName}`);
            throw new Error('No data found');
        }

        const wikidataId = results.wikidataId?.value.split('/').pop();
        console.log(`${prefix} Found Wikidata ID: ${wikidataId}`);

        if (wikidataId && targetPrefix === 'planet') {
            await fetchAndDisplayWikidataInfo(wikidataId);
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

// Data processing functions
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
            wikipedia: `https://en.wikipedia.org/wiki/${planetName.replace(/ /g, '_')}`,
            dbpedia: `http://dbpedia.org/resource/${planetName.replace(/ /g, '_')}`,
            wikidata: results.wikidataId?.value
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

// Display functions
function displayLanguageLabels(labels) {
    if (labels.length === 0) return;

    const labelMap = labels.reduce((acc, curr) => {
        acc[curr.langCode.value] = curr.label.value;
        return acc;
    }, {});

    const nameDiv = document.getElementById("planet-name");
    if (!nameDiv) return;

    const languageSection = `
        <div class="flex flex-wrap justify-center gap-6 text-lg mt-4">
            ${Object.entries(labelMap).map(([lang, name]) => `
                <div class="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg shadow-sm">
                    <span class="text-2xl" role="img" aria-label="${LANGUAGE_INFO[lang].name} flag">
                        ${LANGUAGE_INFO[lang].emoji}
                    </span>
                    <div class="flex flex-col">
                        <span class="text-gray-500 text-sm font-medium">${LANGUAGE_INFO[lang].name}</span>
                        <span class="font-medium">${name}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    nameDiv.insertAdjacentHTML('afterend', languageSection);
}

function displayAtmosphereData(atmosphereResults) {
    if (atmosphereResults.length === 0) return;

    const atmosphereSection = document.createElement('div');
    atmosphereSection.className = 'bg-white p-6 shadow-md rounded-md mb-4';
    atmosphereSection.innerHTML = generateAtmosphereHTML(atmosphereResults);

    const temperatureSection = document.querySelector('.grid.grid-cols-2.gap-4.mb-4');
    if (temperatureSection) {
        temperatureSection.parentNode.insertBefore(atmosphereSection, temperatureSection);
    }
}

function generateAtmosphereHTML(atmosphereResults) {
    return `
        <h2 class="text-lg font-semibold mb-4">Atmosphere Composition</h2>
        <div class="space-y-4">
            ${atmosphereResults.some(r => r.proportion) ? `
                <div class="relative h-8 bg-gray-200 rounded-lg overflow-hidden">
                    ${generateAtmosphereBarSegments(atmosphereResults)}
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    ${generateAtmosphereLegend(atmosphereResults)}
                </div>
            ` : `
                <p class="text-gray-600 italic">No detailed composition data available</p>
            `}
        </div>
    `;
}

function generateAtmosphereBarSegments(results) {
    return results
        .filter(r => r.proportion)
        .map((r, index) => {
            const percentage = parseFloat(r.proportion.value) * 100;
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-indigo-500'];
            const left = index === 0 ? 0 : results
                .filter(r => r.proportion)
                .slice(0, index)
                .reduce((acc, r) => acc + parseFloat(r.proportion.value) * 100, 0);

            return `
                <div class="${colors[index % colors.length]} h-full absolute"
                     style="left: ${left}%; width: ${percentage}%">
                </div>
            `;
        }).join('');
}

function generateAtmosphereLegend(results) {
    return results
        .filter(r => r.proportion && r.materialLabel)
        .map((r, index) => {
            const colors = ['text-blue-500', 'text-green-500', 'text-yellow-500', 'text-red-500', 'text-purple-500', 'text-indigo-500'];
            return `
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full ${colors[index % colors.length].replace('text-', 'bg-')}"></div>
                    <div>
                        <div class="font-medium">${r.materialLabel.value}</div>
                        <div class="text-sm text-gray-600">${(parseFloat(r.proportion.value) * 100).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        }).join('');
}

// Display functions for comparison table
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
                <td class="px-4 py-2">${isEarth ? 'Same as selected planet' :
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
    generateExternalLinksHTML
}; 