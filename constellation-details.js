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
            PREFIX dct: <http://purl.org/dc/terms/>
            
            SELECT DISTINCT ?constellation ?name ?abstract (SAMPLE(?img) as ?image) 
                ?stars ?area ?rightAscension ?declination ?symbolism 
                ?meteorShowers ?brightestStar ?hemisphere ?season
                ?zodiacSign ?zodiacSignName ?numberOfPlanets ?month ?family
                ?latmin ?latmax ?neareststarname
                (GROUP_CONCAT(DISTINCT ?neighbourName; SEPARATOR=", ") as ?neighbours)
            WHERE {
                ?constellation a dbo:Constellation ;
                    rdfs:label ?name ;
                    dbo:abstract ?abstract .
                OPTIONAL { ?constellation foaf:depiction ?img }
                OPTIONAL { ?constellation dbp:stars ?stars }
                OPTIONAL { ?constellation dbo:area ?area }
                OPTIONAL { ?constellation dbp:rightAscension ?rightAscension }
                OPTIONAL { ?constellation dbp:declination ?declination }
                OPTIONAL { ?constellation dbp:symbolism ?symbolism }
                OPTIONAL { ?constellation dbp:meteorShowers ?meteorShowers }
                OPTIONAL { ?constellation dbp:brightestStar ?brightestStar }
                OPTIONAL { ?constellation dbp:hemisphere ?hemisphere }
                OPTIONAL { ?constellation dbp:season ?season }
                OPTIONAL { 
                    ?constellation dbp:zodiacSign ?zodiacSign .
                    ?zodiacSign rdfs:label ?zodiacSignName .
                    FILTER(LANG(?zodiacSignName) = 'en')
                }
                OPTIONAL { ?constellation dbp:numberOfPlanets ?numberOfPlanets }
                OPTIONAL { ?constellation dbp:month ?month }
                OPTIONAL { ?constellation dbp:family ?family }
                OPTIONAL { ?constellation dbp:latmin ?latmin }
                OPTIONAL { ?constellation dbp:latmax ?latmax }
                OPTIONAL { ?constellation dbp:neareststarname ?neareststarname }
                OPTIONAL { 
                    ?constellation dbp:bordering ?neighbour .
                    ?neighbour rdfs:label ?neighbourName .
                    FILTER(LANG(?neighbourName) = 'en')
                }
                FILTER (LANG(?abstract) = 'en')
                FILTER (LANG(?name) = 'en')
                FILTER (!CONTAINS(?abstract, "may refer to"))
                FILTER (!CONTAINS(?abstract, "disambiguation"))
                FILTER (LCASE(?name) = LCASE("${decodeURIComponent(constellationName)}"))
            }
            GROUP BY ?constellation ?name ?abstract ?stars ?area ?rightAscension ?declination 
                ?symbolism ?meteorShowers ?brightestStar ?hemisphere ?season
                ?zodiacSign ?zodiacSignName ?numberOfPlanets ?month ?family
                ?latmin ?latmax ?neareststarname
        `;

        const url = `https://dbpedia.org/sparql?query=${encodeURIComponent(query)}&format=json`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        const data = await response.json();
        if (data.results.bindings.length === 0) return null;

        const result = data.results.bindings[0];
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
    if (constellation.area) basicInfo.push(`Area: ${parseFloat(constellation.area).toFixed(2)} sq. degrees`);
    if (constellation.rightAscension) basicInfo.push(`Right Ascension: ${constellation.rightAscension}`);
    if (constellation.declination) basicInfo.push(`Declination: ${constellation.declination}`);
    if (constellation.latmin && constellation.latmax) {
        basicInfo.push(`Latitude Range: ${constellation.latmin}° to ${constellation.latmax}°`);
    }
    
    if (basicInfo.length > 0) {
        sections.push({
            title: "Technical Details",
            content: basicInfo.join('<br>')
        });
    }

    // Stars Information
    const starInfo = [];
    if (constellation.stars) starInfo.push(`Number of main stars: ${constellation.stars}`);
    if (constellation.brightestStar) starInfo.push(`Brightest star: ${constellation.brightestStar}`);
    if (constellation.neareststarname) {
        const nearestStars = constellation.neareststarname.split(',').map(star => star.trim());
        starInfo.push(`Nearest stars: ${nearestStars.join(', ')}`);
    }
    
    if (starInfo.length > 0) {
        sections.push({
            title: "Stars",
            content: starInfo.join('<br>')
        });
    }

    // Symbolism and Cultural Significance
    if (constellation.symbolism) {
        sections.push({
            title: "Symbolism",
            content: constellation.symbolism
        });
    }

    // Zodiac Information
    const zodiacInfo = [];
    if (constellation.zodiacSignName) {
        const zodiacLink = constellation.zodiacSign ? 
            `<a href="${constellation.zodiacSign}" target="_blank" class="text-cyan-400 hover:text-cyan-300">${constellation.zodiacSignName}</a>` :
            constellation.zodiacSignName;
        zodiacInfo.push(`Zodiac Sign: ${zodiacLink}`);
    }
    if (constellation.month) zodiacInfo.push(`Month: ${constellation.month}`);
    
    if (zodiacInfo.length > 0) {
        sections.push({
            title: "Zodiac Information",
            content: zodiacInfo.join('<br>')
        });
    }

    // Location and Visibility
    const visibilityInfo = [];
    if (constellation.hemisphere) visibilityInfo.push(`Hemisphere: ${constellation.hemisphere}`);
    if (constellation.season) visibilityInfo.push(`Best viewing season: ${constellation.season}`);
    
    if (visibilityInfo.length > 0) {
        sections.push({
            title: "Visibility",
            content: visibilityInfo.join('<br>')
        });
    }

    // Celestial Objects
    const celestialInfo = [];
    if (constellation.numberOfPlanets) celestialInfo.push(`Number of planets: ${constellation.numberOfPlanets}`);
    if (constellation.meteorShowers) celestialInfo.push(`Associated meteor showers: ${constellation.meteorShowers}`);
    
    if (celestialInfo.length > 0) {
        sections.push({
            title: "Celestial Objects",
            content: celestialInfo.join('<br>')
        });
    }

    // Neighboring Constellations
    if (constellation.neighbours) {
        sections.push({
            title: "Neighboring Constellations",
            content: constellation.neighbours
        });
    }

    return sections;
}

// Format constellation badges
function formatConstellationBadges(constellation) {
    const badges = [];
    
    if (constellation.zodiacSignName) {
        badges.push(`Zodiac: ${constellation.zodiacSignName}`);
    }
    if (constellation.stars) {
        badges.push(`${constellation.stars} stars`);
    }
    if (constellation.numberOfPlanets) {
        badges.push(`${constellation.numberOfPlanets} planets`);
    }
    if (constellation.month) {
        badges.push(`Best month: ${constellation.month}`);
    }
    
    return badges;
}

// Initialize page
async function initializeConstellationPage() {
    try {
        const constellation = await getConstellationData();
        if (!constellation) {
            console.error('No constellation data found');
            window.location.href = 'constellations.html';
            return;
        }

        // Update page title
        document.title = `${constellation.name} - Astronomical Explorer`;

        // Set constellation image
        const imageElement = document.getElementById('constellationImage');
        if (constellation.image) {
            imageElement.style.backgroundImage = `url(${constellation.image})`;
            imageElement.style.display = 'block';
        } else {
            imageElement.style.display = 'none';
        }

        // Set constellation name
        document.getElementById('constellationName').textContent = constellation.name;

        // Set constellation badges
        const badges = formatConstellationBadges(constellation);
        document.getElementById('constellationBadges').innerHTML = badges.map(badge => `
            <div class="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm">
                ${badge}
            </div>
        `).join('');

        // Set constellation abstract
        document.getElementById('constellationAbstract').textContent = constellation.abstract;

        // Set constellation details
        const sections = formatConstellationDetails(constellation);
        document.getElementById('constellationDetails').innerHTML = sections.map(section => `
            <div class="glass rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    ${section.title}
                </h2>
                <div class="text-gray-300">
                    ${section.content}
                </div>
            </div>
        `).join('');
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