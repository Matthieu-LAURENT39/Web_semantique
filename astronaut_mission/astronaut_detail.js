const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Récupérer les paramètres de l'URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


// Fonction pour fetch les détails d'un astronaute en particulier 
async function loadAstronautDetails() {
    astronautURI = getQueryParam("uri")
    console.log(astronautURI)
    try {
        let query = `
            SELECT DISTINCT ?label ?abstract ?birthDate 
                SAMPLE(?thumbnail) as ?img
                (GROUP_CONCAT(DISTINCT ?one_status; separator=", ") AS ?status)
                (GROUP_CONCAT(DISTINCT ?mission; separator=", ") AS ?missions)
                (GROUP_CONCAT(DISTINCT ?type; separator=", ") AS ?types)
                (GROUP_CONCAT(DISTINCT ?birthplace; separator=", ") AS ?birthplaces)
                (COALESCE(?n1, ?n2) as ?nationality)
                (GROUP_CONCAT(DISTINCT ?nationality; separator=", ") AS ?nationalities)
                                
                WHERE {
                    <${astronautURI}> rdfs:label ?label ;
                                                                foaf:depiction ?thumbnail ;
                                                                dbo:abstract ?abstract.
                    OPTIONAL { <${astronautURI}> dbo:birthPlace ?birthplace.}
                    OPTIONAL { <${astronautURI}> dbo:birthDate ?birthDate. }
                    OPTIONAL { <${astronautURI}> dbp:status ?one_status. }
                    OPTIONAL { <${astronautURI}> dbp:type ?type. }
                    OPTIONAL { <${astronautURI}> dbo:mission ?mission. }
                    OPTIONAL { <${astronautURI}> dbo:nationality ?n1. }
                    OPTIONAL { <${astronautURI}> dbp:nationality ?n2. }
                    FILTER(LANG(?label) = 'en')
                    FILTER(LANG(?abstract) = 'en')
                }
                GROUP BY ?label ?abstract ?birthDate ?status ?nationalities ?n1 ?n2

            `;
        query = encodeURIComponent(query);

        const url = `${DBPEDIA_ENDPOINT}?query=${query}&format=json`;
        const response = await fetch(url, {
            headers: {
                    'Accept': 'application/sparql-results+json'
                }
            });
        
        if (!response.ok) throw new Error('Network error');
            
        const data = await response.json();
        const result = data.results.bindings[0]; 
       
        if (result) {
            showDetailsAstronaut(result);
        } else {
            console.error("No details found for the astronaut.");
        }
    } catch (error) {
        console.error("Error loading astronaut details:", error);
    }
}

// Fonction pour afficher les détails dans le modal
function showDetailsAstronaut(result) {
    
    const content_detail_astronaut = document.getElementById('content-detail-astronaut');

    const label = result.label?.value || 'No name';
    const abstract = result.abstract?.value || 'No description available';
    const nationality = result.nationalities?.value || 'Unknown';
    const img = result.img?.value || 'default-astronaut.svg';
    const birthPlace = result.birthplaces?.value || 'Unknown';
    const birthDate = result.birthDate?.value || 'Unknown';
    const status = result.status?.value || 'Unknown';
    const astronautType = result.types?.value || 'Unknown';
    const missions = result.missions?.value || 'None';

    document.getElementById("astronaut-img").src = img;
    document.getElementById("astronaut-img").alt = label;
    document.getElementById("astronaut-label").textContent = label;

    // Mise à jour des détails
    document.getElementById("astronaut-description").textContent = abstract;
    document.getElementById("astronaut-nationality").textContent = nationality;
    document.getElementById("astronaut-birthplace").textContent = birthPlace;
    document.getElementById("astronaut-birthdate").textContent = birthDate;
    document.getElementById("astronaut-status").textContent = status;
    document.getElementById("astronaut-type").textContent = astronautType;
    document.getElementById("astronaut-missions").textContent = missions;

}

loadAstronautDetails();