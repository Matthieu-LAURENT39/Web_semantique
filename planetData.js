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
    return `
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX dbp: <http://dbpedia.org/property/>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        SELECT ?abstract ?maxTemp ?meanTemp ?minTemp ?averageSpeed ?density ?surfaceArea ?volume ?wikidataId
               (GROUP_CONCAT(DISTINCT ?satellite; SEPARATOR="|") as ?satellites)
               (GROUP_CONCAT(DISTINCT ?parentBody; SEPARATOR="|") as ?parentBodies)
        WHERE {
            dbr:${encodedPlanetName} dbo:abstract ?abstract ;
                                    owl:sameAs ?wikidataId .
            FILTER(CONTAINS(STR(?wikidataId), "wikidata.org"))
            OPTIONAL { dbr:${encodedPlanetName} dbo:maximumTemperature ?maxTemp }
            OPTIONAL { dbr:${encodedPlanetName} dbo:meanTemperature ?meanTemp }
            OPTIONAL { dbr:${encodedPlanetName} dbo:minimumTemperature ?minTemp }
            OPTIONAL { dbr:${encodedPlanetName} dbo:averageSpeed ?averageSpeed }
            OPTIONAL { dbr:${encodedPlanetName} dbo:density ?density }
            OPTIONAL { dbr:${encodedPlanetName} dbo:surfaceArea ?surfaceArea }
            OPTIONAL { dbr:${encodedPlanetName} dbo:volume ?volume }
            OPTIONAL { 
                {
                    ?satellite dbp:satelliteOf dbr:${encodedPlanetName} 
                } UNION {
                    dbr:${encodedPlanetName} ^dbp:satelliteOf ?satellite
                }
            }
            OPTIONAL { dbr:${encodedPlanetName} dbp:satelliteOf ?parentBody }
            FILTER (lang(?abstract) = "en")
        } 
        GROUP BY ?abstract ?maxTemp ?meanTemp ?minTemp ?averageSpeed ?density ?surfaceArea ?volume ?wikidataId
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
    const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url, { headers });
    return response.json();
}

async function fetchWikipediaImage(planetName) {
    try {
        const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${planetName}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const wikiResponse = await fetch(wikiApiUrl);
        const wikiData = await wikiResponse.json();
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pages[pageId].thumbnail) {
            return pages[pageId].thumbnail.source;
        }
    } catch (error) {
        console.error("Error fetching Wikipedia image:", error);
    }
    return null;
}

async function fetchPlanetData(planetName, targetPrefix) {
    const encodedPlanetName = planetName.replace(/ /g, '_');
    const query = buildDBPediaQuery(encodedPlanetName);

    // Start fetching Wikipedia image in the background only for the main planet view
    if (targetPrefix === 'planet') {
        window.wikiImagePromise = fetchWikipediaImage(planetName);
    }

    try {
        const data = await fetchSPARQLData(DBPEDIA_ENDPOINT, query);
        const results = data.results.bindings[0];

        if (!results) {
            throw new Error('No data found');
        }

        const wikidataId = results.wikidataId?.value.split('/').pop();
        console.log("Extracted Wikidata ID:", wikidataId);

        if (wikidataId && targetPrefix === 'planet') {
            await fetchAndDisplayWikidataInfo(wikidataId);
        }

        return processDBPediaResults(results, planetName, targetPrefix);
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
    }
}

async function fetchAndDisplayWikidataInfo(wikidataId) {
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
        console.error("Error fetching Wikidata data:", error);
    }
}

// Data processing functions
function processDBPediaResults(results, planetName, targetPrefix) {
    const processedData = {
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
        parentBodies: processSatellites(results.parentBodies?.value)
    };

    // Store data for comparison
    if (targetPrefix === 'planet') {
        window.planetData = processedData.physicalProperties;
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
    return results
        .filter(r => r.proportion)
        .map((r, index) => {
            const percentage = parseFloat(r.proportion.value) * 100;
            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-indigo-500'];
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

    const planetName = document.getElementById("planet-table-header").textContent;
    const isEarth = planetName.toLowerCase() === 'earth';

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

// Export functions for use in planet.html
window.PlanetData = {
    fetchPlanetData,
    kelvinToCelsius,
    tempToPercent,
    updateComparisonTable,
    fetchWikipediaImage
}; 