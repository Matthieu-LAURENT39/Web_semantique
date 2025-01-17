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
                ?symbolism ?brightestStar ?month ?latmin ?latmax ?neareststarname
                (GROUP_CONCAT(DISTINCT ?neighbourName; SEPARATOR=", ") as ?neighbours)
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
                OPTIONAL { ?constellation dbp:neareststarname ?neareststarname }
                OPTIONAL { 
                    ?constellation dbp:bordering ?neighbour .
                    ?neighbour rdfs:label ?neighbourName
                }
                FILTER(CONTAINS(LCASE(?name), LCASE("${decodeURIComponent(constellationName)}")))
            }
            GROUP BY ?constellation ?name ?abstract 
                ?symbolism ?brightestStar ?month
                ?latmin ?latmax ?neareststarname
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
            neighbours: result.neighbours ? result.neighbours.value : null
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
    
    if (basicInfo.length > 0) {
        sections.push({
            title: "Basic Information",
            content: basicInfo.join('<div class="border-b border-gray-700 my-2"></div>')
        });
    }

    // Stars Information
    const starInfo = [];
    if (constellation.brightestStar) starInfo.push(`<div class="flex justify-between items-center">
        <span class="text-gray-400">Brightest Star</span>
        <span>${constellation.brightestStar}</span>
    </div>`);
    if (constellation.neareststarname) {
        const nearestStars = constellation.neareststarname.split(',').map(star => star.trim());
        starInfo.push(`<div class="flex justify-between items-center">
            <span class="text-gray-400">Nearest Stars</span>
            <span class="text-right">${nearestStars.join(', ')}</span>
        </div>`);
    }
    
    if (starInfo.length > 0) {
        sections.push({
            title: "Stars Information",
            content: starInfo.join('<div class="border-b border-gray-700 my-2"></div>')
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
    if (constellation.neighbours) {
        sections.push({
            title: "Bording Constellations",
            content: `<p class="text-gray-300">${constellation.neighbours}</p>`
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
    if (constellation.stars) {
        badges.push(`<div class="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 font-medium">
            ${constellation.stars} étoiles
        </div>`);
    }
    if (constellation.numberOfPlanets) {
        badges.push(`<div class="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 font-medium">
            ${constellation.numberOfPlanets} planètes
        </div>`);
    }
    if (constellation.month) {
        badges.push(`<div class="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-medium">
            ${constellation.month}
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