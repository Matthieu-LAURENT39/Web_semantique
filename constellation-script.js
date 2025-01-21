// DBpedia SPARQL endpoint
const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Add pagination state
let currentPage = 1;
const itemsPerPage = 10;
let totalResults = 0;
let currentSearchTerm = 'An'; // Store the current search term

// Initialize page with default search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('constellationSearch');
    searchInput.value = '';
    searchConstellations(currentSearchTerm);
});

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
function createSPARQLQuery(searchTerm, offset) {
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
        OFFSET ${offset}
        LIMIT ${itemsPerPage}
    `;

    return query;
}

// Function to create pagination controls
function createPaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'flex justify-center items-center space-x-2 mt-8';

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = `px-4 py-2 rounded-xl ${currentPage === 1 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-cyan-500 text-white hover:bg-cyan-600'} transition-colors duration-200`;
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            searchConstellations(currentSearchTerm, true);
        }
    };

    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = `px-4 py-2 rounded-xl ${currentPage >= totalPages ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-cyan-500 text-white hover:bg-cyan-600'} transition-colors duration-200`;
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            searchConstellations(currentSearchTerm, true);
        }
    };

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'text-gray-300';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextButton);

    return paginationContainer;
}

// Function to count total results
async function countTotalResults(searchTerm) {
    const countQuery = `
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT (COUNT(DISTINCT ?constellation) as ?count)
        WHERE {
            ?constellation a dbo:Constellation ;
                rdfs:label ?name ;
                dbo:abstract ?abstract .
            FILTER (LANG(?abstract) = 'en')
            FILTER (LANG(?name) = 'en')
            FILTER (!CONTAINS(?abstract, "may refer to"))
            FILTER (!CONTAINS(?abstract, "disambiguation"))
            ${searchTerm ? `FILTER (CONTAINS(LCASE(?name), "${searchTerm.toLowerCase()}"))` : ''}
        }
    `;

    const url = `${DBPEDIA_ENDPOINT}?query=${encodeURIComponent(countQuery)}&format=json`;
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/sparql-results+json'
        }
    });
    const data = await response.json();
    return parseInt(data.results.bindings[0].count.value);
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
    card.className = 'constellation-card bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.01] border border-gray-700/50';
    card.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = encodeURIComponent(constellation.name);
        const detailsUrl = `constellation-details.html?name=${name}`;
        window.location.href = detailsUrl;
    };
    
    const imageHtml = constellation.image ? `
        <div class="w-48 h-48 rounded-xl overflow-hidden flex-shrink-0">
            <img src="${constellation.image}" alt="${constellation.name}" class="w-full h-full object-cover">
        </div>
    ` : '';

    const details = formatConstellationDetails(constellation);
    const detailsHtml = details.length > 0 ? `
        <div class="flex flex-wrap gap-2 mb-4">
            ${details.map(detail => `
                <div class="inline-block px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm font-medium">
                    ${detail}
                </div>
            `).join('')}
        </div>
    ` : '';
    
    card.innerHTML = `
        <div class="flex gap-6">
            ${imageHtml}
            <div class="flex-grow min-w-0">
                <h2 class="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    ${constellation.name}
                </h2>
                ${detailsHtml}
                <p class="text-gray-300 line-clamp-3">
                    ${constellation.abstract}
                </p>
            </div>
        </div>
    `;
    
    return card;
}

// Main search function
async function searchConstellations(defaultTerm = null, isPageChange = false) {
    const searchInput = document.getElementById('constellationSearch');
    const searchTerm = defaultTerm || searchInput.value.trim();
    
    // Update current search term if it's a new search
    if (!isPageChange) {
        currentSearchTerm = searchTerm;
        currentPage = 1;
    }

    const resultsContainer = document.getElementById('constellationResults');
    const offset = (currentPage - 1) * itemsPerPage;
    
    setLoading(true);
    resultsContainer.innerHTML = '';
    
    try {
        // Only update total results if it's a new search
        if (!isPageChange) {
            totalResults = await countTotalResults(searchTerm);
        }

        const query = createSPARQLQuery(searchTerm, offset);
        const url = `${DBPEDIA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        const data = await response.json();
        const results = data.results.bindings;
        
        if (results.length === 0 && totalResults === 0) {
            resultsContainer.innerHTML = `
                <div class="glass rounded-2xl p-6">
                    <p class="text-center text-gray-300">
                        No constellations found
                    </p>
                </div>
            `;
            return;
        }
        
        // Create results grid with full width
        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'flex flex-col space-y-4';
        
        results.forEach(result => {
            const constellation = {
                name: result.name.value,
                abstract: result.abstract.value,
                image: result.image ? result.image.value : null,
                month: result.month ? result.month.value : null,
                arearank: result.arearank ? result.arearank.value : null
            };
            
            resultsGrid.appendChild(createConstellationCard(constellation));
        });
        
        resultsContainer.appendChild(resultsGrid);
        
        // Add pagination controls if there are results
        if (totalResults > itemsPerPage) {
            resultsContainer.appendChild(createPaginationControls(totalResults));
        }
        
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
        const searchTerm = document.getElementById('constellationSearch').value.trim();
        currentSearchTerm = searchTerm; // Update current search term
        currentPage = 1; // Reset to first page on new search
        searchConstellations();
    }
}); 