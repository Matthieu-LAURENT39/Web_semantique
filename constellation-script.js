// DBpedia SPARQL endpoint
const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Function to toggle constellation definition
function toggleDefinition() {
    const definition = document.getElementById('constellationDefinition');
    const knowMoreText = document.getElementById('knowMoreText');
    const knowMoreIcon = document.getElementById('knowMoreIcon');
    
    if (definition.classList.contains('hidden')) {
        definition.classList.remove('hidden');
        knowMoreText.textContent = 'Show Less';
        knowMoreIcon.style.transform = 'rotate(180deg)';
    } else {
        definition.classList.add('hidden');
        knowMoreText.textContent = 'Know More';
        knowMoreIcon.style.transform = 'rotate(0)';
    }
}

// Helper function to create SPARQL query based on search criteria
function createSPARQLQuery(searchTerm) {
    searchTerm = searchTerm.toLowerCase();
    
    let query = `
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX dbp: <http://dbpedia.org/property/>
        PREFIX dct: <http://purl.org/dc/terms/>
        
        SELECT DISTINCT ?constellation ?name ?abstract (SAMPLE(?img) as ?image) 
            ?symbolism ?zodiacSign ?zodiacSignName ?month ?arearank
        WHERE {
            ?constellation a dbo:Constellation ;
                rdfs:label ?name ;
                dbo:abstract ?abstract .
            OPTIONAL { ?constellation foaf:depiction ?img }
            OPTIONAL { 
                ?constellation dbp:zodiacSign ?zodiacSign .
                ?zodiacSign rdfs:label ?zodiacSignName .
                FILTER(LANG(?zodiacSignName) = 'en')
            }
            OPTIONAL { ?constellation dbp:month ?month }
            OPTIONAL { ?constellation dbp:arearank ?arearank }
            FILTER (LANG(?abstract) = 'en')
            FILTER (LANG(?name) = 'en')
            FILTER (!CONTAINS(?abstract, "may refer to"))
            FILTER (!CONTAINS(?abstract, "disambiguation"))
    `;

    if (searchTerm) {
        query += `FILTER (CONTAINS(LCASE(?name), "${searchTerm}"))`;
    }

    query += `
        }
        GROUP BY ?constellation ?name ?abstract ?symbolism
            ?zodiacSign ?zodiacSignName ?month ?arearank
        ORDER BY ?name
        LIMIT 100
    `;

    return query;
}

// Function to display loading indicator
function setLoading(isLoading) {
    const loader = document.getElementById('loadingIndicator');
    if (isLoading) {
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

// Function to format constellation details for cards
function formatConstellationDetails(constellation) {
    const details = [];
    
    if (constellation.month) {
        details.push(`Best month: ${constellation.month}`);
    }
    if (constellation.arearank) {
        details.push(`Rank #${constellation.arearank}`);
    }
    
    return details;
}

// Function to show constellation modal
function showConstellationDetails(constellation) {
    const modal = document.getElementById('constellationModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDetails = document.getElementById('modalDetails');
    const modalDescription = document.getElementById('modalDescription');
    const modalAdditionalInfo = document.getElementById('modalAdditionalInfo');

    // Set title and description
    modalTitle.textContent = constellation.name;
    modalDescription.textContent = constellation.abstract;

    // Set image if available
    if (constellation.image) {
        modalImage.style.backgroundImage = `url(${constellation.image})`;
        modalImage.style.display = 'block';
    } else {
        modalImage.style.display = 'none';
    }

    // Set details badges
    const details = formatConstellationDetails(constellation);
    modalDetails.innerHTML = details.map(detail => `
        <div class="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm">
            ${detail}
        </div>
    `).join('');

    // Show modal with animation
    modal.classList.add('active');
}

// Function to close modal
function closeModal() {
    const modal = document.getElementById('constellationModal');
    modal.classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('constellationModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        closeModal();
    }
});

// Function to create a constellation card
function createConstellationCard(constellation) {
    const card = document.createElement('div');
    card.className = 'constellation-card rounded-2xl p-6 space-y-4';
    card.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = encodeURIComponent(constellation.name);
        const detailsUrl = `constellation-details.html?name=${name}`;
        window.location.href = detailsUrl;
    };
    
    const imageHtml = constellation.image ? `
        <div class="w-full h-48 rounded-xl overflow-hidden mb-4">
            <img src="${constellation.image}" alt="${constellation.name}" class="w-full h-full object-cover">
        </div>
    ` : '';

    const details = formatConstellationDetails(constellation);
    const detailsHtml = details.length > 0 ? `
        <div class="flex flex-wrap gap-2 mb-4">
            ${details.map(detail => `
                <div class="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm">
                    ${detail}
                </div>
            `).join('')}
        </div>
    ` : '';
    
    card.innerHTML = `
        ${imageHtml}
        <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            ${constellation.name}
        </h2>
        ${detailsHtml}
        <p class="text-gray-300 line-clamp-3">
            ${constellation.abstract}
        </p>
    `;
    
    return card;
}

// Main search function
async function searchConstellations() {
    const searchTerm = document.getElementById('constellationSearch').value.trim();
    const resultsContainer = document.getElementById('constellationResults');
    
    setLoading(true);
    resultsContainer.innerHTML = '';
    
    try {
        const query = createSPARQLQuery(searchTerm);
        const url = `${DBPEDIA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        const data = await response.json();
        const results = data.results.bindings;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="glass rounded-2xl p-6">
                    <p class="text-center text-gray-300">
                        No constellations found
                    </p>
                </div>
            `;
            return;
        }
        
        results.forEach(result => {
            const constellation = {
                name: result.name.value,
                abstract: result.abstract.value,
                image: result.image ? result.image.value : null,
                stars: result.stars ? result.stars.value : null,
                arearank: result.arearank ? result.arearank.value : null,
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
            
            resultsContainer.appendChild(createConstellationCard(constellation));
        });
        
    } catch (error) {
        console.error('Error fetching data:', error);
        resultsContainer.innerHTML = `
            <div class="glass rounded-2xl p-6">
                <p class="text-center text-red-400">
                    An error occurred while searching
                </p>
            </div>
        `;
    } finally {
        setLoading(false);
    }
}

// Add event listener for Enter key
document.getElementById('constellationSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchConstellations();
    }
}); 