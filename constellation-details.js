// Get constellation name from URL parameters and fetch data
async function getConstellationData() {
    const urlParams = new URLSearchParams(window.location.search);
    const constellationName = urlParams.get('name');
    if (!constellationName) return null;

    try {
        const query = `
            PREFIX dbo: <http://dbpedia.org/ontology/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX dbp: <http://dbpedia.org/property/>
            
            SELECT DISTINCT ?constellation ?name ?abstract (SAMPLE(?img) as ?image) 
                ?symbolism 
                (REPLACE(STR(?brightestStar), "^.*/([^/]+)$", "$1") as ?brightestStar)
                ?month ?latmin ?latmax ?areatotal ?arearank
                ?numbermainstars ?numberstarsplanets ?numberbrightstars ?numbermessierobjects
                (REPLACE(STR(?neareststarname), "^.*/([^/]+)$", "$1") as ?neareststarname)
                (GROUP_CONCAT(DISTINCT ?borderingName; SEPARATOR=", ") as ?bordering)
                (GROUP_CONCAT(DISTINCT ?galaxyName; SEPARATOR=", ") as ?galaxies)
                (GROUP_CONCAT(DISTINCT ?starName; SEPARATOR=", ") as ?stars)
            WHERE {
                ?constellation a dbo:Constellation ;
                    rdfs:label ?name ;
                    dbo:abstract ?abstract .
                OPTIONAL { ?constellation foaf:depiction ?img }
                OPTIONAL { ?constellation dbp:symbolism ?symbolism }
                OPTIONAL { ?constellation dbp:brighteststarname ?brightestStar }
                OPTIONAL { ?constellation dbp:month ?month }
                OPTIONAL { ?constellation dbp:latmin ?latmin }
                OPTIONAL { ?constellation dbp:latmax ?latmax }
                OPTIONAL { ?constellation dbp:areatotal ?areatotal }
                OPTIONAL { ?constellation dbp:arearank ?arearank }
                OPTIONAL { ?constellation dbp:numbermainstars ?numbermainstars }
                OPTIONAL { ?constellation dbp:numberstarsplanets ?numberstarsplanets }
                OPTIONAL { ?constellation dbp:numberbrightstars ?numberbrightstars }
                OPTIONAL { ?constellation dbp:numbermessierobjects ?numbermessierobjects }
                OPTIONAL { ?constellation dbp:neareststarname ?neareststarname }
                OPTIONAL { 
                    ?constellation dbp:bordering ?borderingConstellation .
                    ?borderingConstellation rdfs:label ?borderingName .
                    FILTER(LANG(?borderingName) = 'en')
                }
                OPTIONAL {
                    ?galaxy a dbo:Galaxy ;
                           rdfs:label ?galaxyName ;
                           dbp:constellationName ?constellation .
                    FILTER(LANG(?galaxyName) = 'en')
                }
                OPTIONAL {
                    ?star a dbo:Star ;
                         rdfs:label ?starName ;
                         dbp:constell ?constellation .
                    FILTER(LANG(?starName) = 'en')
                }
                FILTER (LANG(?abstract) = 'en')
                FILTER (LANG(?name) = 'en')
                FILTER(CONTAINS(LCASE(?name), LCASE("${decodeURIComponent(constellationName)}")))
            }
            GROUP BY ?constellation ?name ?abstract 
                ?symbolism ?brightestStar ?month
                ?latmin ?latmax ?areatotal ?arearank ?neareststarname
                ?numbermainstars ?numberstarsplanets ?numberbrightstars ?numbermessierobjects
            LIMIT 1
        `;

        const url = `https://dbpedia.org/sparql?query=${encodeURIComponent(query)}&format=json`;
        console.log('Fetching constellation data with URL:', url);
        console.log('Searching for constellation:', constellationName);
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        const data = await response.json();
        console.log('Received data:', data);
        
        if (data.results.bindings.length === 0) {
            console.log('No results found for constellation:', constellationName);
            return null;
        }

        const result = data.results.bindings[0];
        console.log('Processing result:', result);
        
        return {
            name: result.name.value,
            abstract: result.abstract.value,
            image: result.image ? result.image.value : null,
            stars: result.stars ? result.stars.value : null,
            area: result.area ? result.area.value : null,
            rightAscension: result.rightAscension ? result.rightAscension.value : null,
            declination: result.declination ? result.declination.value : null,
            symbolism: result.symbolism ? result.symbolism.value : null,
            meteorShowers: result.meteorShowers ? result.meteorShowers.value : null,
            brightestStar: result.brightestStar ? result.brightestStar.value : null,
            hemisphere: result.hemisphere ? result.hemisphere.value : null,
            season: result.season ? result.season.value : null,
            zodiacSign: result.zodiacSign ? result.zodiacSign.value : null,
            zodiacSignName: result.zodiacSignName ? result.zodiacSignName.value : null,
            numberOfPlanets: result.numberOfPlanets ? result.numberOfPlanets.value : null,
            month: result.month ? result.month.value : null,
            family: result.family ? result.family.value : null,
            latmin: result.latmin ? result.latmin.value : null,
            latmax: result.latmax ? result.latmax.value : null,
            neareststarname: result.neareststarname ? result.neareststarname.value : null,
            bordering: result.bordering ? result.bordering.value : null,
            galaxies: result.galaxies ? result.galaxies.value : null,
            stars: result.stars ? result.stars.value : null,
            areatotal: result.areatotal ? result.areatotal.value : null,
            arearank: result.arearank ? result.arearank.value : null,
            numbermainstars: result.numbermainstars ? result.numbermainstars.value : null,
            numberstarsplanets: result.numberstarsplanets ? result.numberstarsplanets.value : null,
            numberbrightstars: result.numberbrightstars ? result.numberbrightstars.value : null,
            numbermessierobjects: result.numbermessierobjects ? result.numbermessierobjects.value : null
        };
    } catch (error) {
        console.error('Error fetching constellation data:', error);
        return null;
    }
}

// Format constellation details sections
function formatConstellationDetails(constellation) {
    let sections = [];

    // Basic Information
    const basicInfo = [];
    if (constellation.latmin && constellation.latmax) {
        basicInfo.push(`<div class="flex justify-between items-center">
            <span class="text-gray-400">Latitude</span>
            <span>${constellation.latmin}° à ${constellation.latmax}°</span>
        </div>`);
    }
    
    if (constellation.areatotal) {
        basicInfo.push(`<div class="flex justify-between items-center">
            <span class="text-gray-400">Total Area</span>
            <span>${constellation.areatotal} square degrees</span>
        </div>`);
    }
    
    if (basicInfo.length > 0) {
        sections.push({
            title: "Basic Information",
            content: basicInfo.join('<div class="border-b border-gray-700 my-2"></div>')
        });
    }

    // Stars Information
    const starInfo = [];
    if (constellation.brightestStar) {
        starInfo.push(`<div class="flex justify-between items-center col-span-2 border-b border-gray-700 pb-3">
            <span class="text-gray-400">Brightest Star</span>
            <span>${constellation.brightestStar}</span>
        </div>`);
    }
    if (constellation.neareststarname) {
        const nearestStars = constellation.neareststarname.split(',').map(star => star.trim());
        starInfo.push(`<div class="flex justify-between items-center col-span-2 border-b border-gray-700 pb-3">
            <span class="text-gray-400">Nearest Stars</span>
            <span class="text-right">${nearestStars.join(', ')}</span>
        </div>`);
    }

    // Create arrays for left and right columns
    const leftColumn = [];
    const rightColumn = [];

    if (constellation.numbermainstars) {
        leftColumn.push(`<div class="flex justify-between items-center py-3">
            <span class="text-gray-400">Main Stars</span>
            <span>${constellation.numbermainstars}</span>
        </div>`);
    }
    if (constellation.numberstarsplanets) {
        rightColumn.push(`<div class="flex justify-between items-center py-3">
            <span class="text-gray-400">Stars with Planets</span>
            <span>${constellation.numberstarsplanets}</span>
        </div>`);
    }
    if (constellation.numberbrightstars) {
        leftColumn.push(`<div class="flex justify-between items-center py-3">
            <span class="text-gray-400">Bright Stars</span>
            <span>${constellation.numberbrightstars}</span>
        </div>`);
    }
    if (constellation.numbermessierobjects) {
        rightColumn.push(`<div class="flex justify-between items-center py-3">
            <span class="text-gray-400">Messier Objects</span>
            <span>${constellation.numbermessierobjects}</span>
        </div>`);
    }

    // Add columns to starInfo if they have content
    if (leftColumn.length > 0 || rightColumn.length > 0) {
        starInfo.push(`
            <div class="border-r border-gray-700 pr-4">
                ${leftColumn.join('<div class="border-b border-gray-700"></div>')}
            </div>
            <div class="pl-4">
                ${rightColumn.join('<div class="border-b border-gray-700"></div>')}
            </div>
        `);
    }
    
    if (starInfo.length > 0) {
        sections.push({
            title: "Stars Information",
            content: `<div class="grid grid-cols-2 gap-4">
                ${starInfo.join('')}
            </div>`
        });
    }

    // Symbolism and Cultural Significance
    if (constellation.symbolism) {
        sections.push({
            title: "Symbolism",
            content: `<p class="text-gray-300 leading-relaxed">${constellation.symbolism}</p>`
        });
    }

    // Zodiac Information
    const zodiacInfo = [];
    if (constellation.month) zodiacInfo.push(`<div class="flex justify-between items-center">
        <span class="text-gray-400">Mois</span>
        <span>${constellation.month}</span>
    </div>`);
    
    if (zodiacInfo.length > 0) {
        sections.push({
            title: "Zodiac Information",
            content: zodiacInfo.join('<div class="border-b border-gray-700 my-2"></div>')
        });
    }

    // Neighboring Constellations
    if (constellation.bordering) {
        const borderingLinks = constellation.bordering.split(', ')
            .map(name => `<a href="constellation-details.html?name=${encodeURIComponent(name)}" 
                class="text-cyan-400 hover:text-cyan-300 transition-colors duration-200">${name}</a>`)
            .join(', ');
        
        sections.push({
            title: "Bordering Constellations",
            content: `<p class="text-gray-300">${borderingLinks}</p>`
        });
    }

    // Stars in the Constellation
    if (constellation.stars) {
        const starCards = constellation.stars.split(', ')
            .map(star => `
                <div class="bg-gradient-to-br from-blue-900/70 via-cyan-900/70 to-indigo-900/70 
                    rounded-xl p-4 backdrop-blur-sm shadow-lg shadow-blue-900/20
                    hover:shadow-blue-700/30 transition-all duration-300 transform hover:scale-[1.02]
                    border border-blue-500/20">
                    <div class="flex items-center space-x-3 mb-2">
                        <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                        </svg>
                        <h3 class="text-lg font-medium bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">${star}</h3>
                    </div>
                </div>
            `).join('');
        
        sections.push({
            title: "Notable Stars",
            content: `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${starCards}
                </div>
            `
        });
    }

    // Galaxies in the Constellation
    if (constellation.galaxies) {
        const galaxyCards = constellation.galaxies.split(', ')
            .map(galaxy => `
                <div class="bg-gradient-to-br from-blue-900/70 via-cyan-900/70 to-indigo-900/70 
                    rounded-xl p-4 backdrop-blur-sm shadow-lg shadow-blue-900/20
                    hover:shadow-blue-700/30 transition-all duration-300 transform hover:scale-[1.02]
                    border border-blue-500/20">
                    <div class="flex items-center space-x-3 mb-2">
                        <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>
                        <h3 class="text-lg font-medium bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">${galaxy}</h3>
                    </div>
                </div>
            `).join('');
        
        sections.push({
            title: "Notable Galaxies",
            content: `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${galaxyCards}
                </div>
            `
        });
    }

    return sections;
}

// Format constellation badges
function formatConstellationBadges(constellation) {
    const badges = [];
    
    if (constellation.zodiacSignName) {
        badges.push(`<div class="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 font-medium">
            ${constellation.zodiacSignName}
        </div>`);
    }
    if (constellation.month) {
        badges.push(`<div class="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-medium">
            ${constellation.month}
        </div>`);
    }
    if (constellation.arearank) {
        badges.push(`<div class="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 font-medium">
            Rank #${constellation.arearank}
        </div>`);
    }
    
    return badges;
}

// Initialize page
async function initializeConstellationPage() {
    try {
        const constellation = await getConstellationData();
        if (!constellation) {
            document.getElementById('constellationHeader').innerHTML = `
                <div class="glass rounded-2xl p-8 text-center">
                    <h1 class="text-2xl font-bold text-red-400 mb-4">Constellation non trouvée</h1>
                    <p class="text-gray-300 mb-6">Désolé, nous n'avons pas pu trouver les informations pour cette constellation.</p>
                    <a href="constellations.html" class="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105">
                        Retourner à la liste des constellations
                    </a>
                </div>
            `;
            document.getElementById('constellationDetails').innerHTML = '';
            return;
        }

        // Update page title
        document.title = `${constellation.name} - Astronomical Explorer`;

        // Set constellation image
        const imageElement = document.getElementById('constellationImage');
        if (constellation.image) {
            imageElement.style.backgroundImage = `url(${constellation.image})`;
            imageElement.style.display = 'block';
            imageElement.className = 'w-full h-96 rounded-2xl bg-cover bg-center mb-8 transform hover:scale-[1.02] transition-all duration-300';
        } else {
            imageElement.style.display = 'none';
        }

        // Set constellation name and abstract
        document.getElementById('constellationHeader').innerHTML = `
            <h1 id="constellationName" class="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                ${constellation.name}
            </h1>
            <div id="constellationBadges" class="flex flex-wrap gap-3 mb-6">
                ${formatConstellationBadges(constellation).join('')}
            </div>
            <p id="constellationAbstract" class="text-gray-300 text-lg leading-relaxed mb-8">
                ${constellation.abstract}
            </p>
        `;

        // Set constellation details
        const sections = formatConstellationDetails(constellation);
        document.getElementById('constellationDetails').innerHTML = sections.map(section => `
            <div class="glass rounded-xl p-6 backdrop-blur-lg transform hover:scale-[1.01] transition-all duration-300">
                <h2 class="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    ${section.title}
                </h2>
                <div class="text-gray-300">
                    ${section.content}
                </div>
            </div>
        `).join('\n<div class="h-4"></div>\n');
    } catch (error) {
        console.error('Error initializing constellation page:', error);
        window.location.href = 'constellations.html';
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing constellation details page...');
    initializeConstellationPage().catch(error => {
        console.error('Failed to initialize page:', error);
        window.location.href = 'constellations.html';
    });
}); 