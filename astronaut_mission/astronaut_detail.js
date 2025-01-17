const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Récupérer les paramètres de l'URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


// Fonction pour fetch les détails d'un astronaute en particulier 
async function loadAstronautDetails() {
    astronautURI = getQueryParam("uri")
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
    document.getElementById("astronaut-nationality").textContent = nationality.split("/").pop().replace(/_/g, " ");
    document.getElementById("astronaut-birthplace").textContent = birthPlace;
    document.getElementById("astronaut-birthdate").textContent = birthDate
    document.getElementById("astronaut-status").textContent = status;
    document.getElementById("astronaut-type").textContent = astronautType;
    

    const birthplaceElement = document.getElementById("astronaut-birthplace");
    if (birthPlace !== 'Unknown') {
        const birthPlaceList = birthPlace.split(",");
        birthplaceElement.innerHTML = ""; // Réinitialiser le contenu
        birthPlaceList.forEach((placeUri) => {
            const placeName = placeUri.split("/").pop().replace(/_/g, " ");
            const listItem = document.createElement("li");
            listItem.textContent = placeName;
            birthplaceElement.appendChild(listItem);
        });
    } else {
        birthplaceElement.textContent = birthPlace; // Afficher "Unknown" si aucune donnée
    }


    const missionsListElement = document.getElementById("astronaut-missions");
    missionsListElement.innerHTML = ""; // Réinitialiser la liste des missions
    if (missions !== 'Unknown') {
        const missionList = missions.split(",");
        missionList.forEach((missionUri) => {
            const missionName = missionUri.split("/").pop().replace(/_/g, " ");
            const listItem = document.createElement("li");
            const link = document.createElement("a");
            link.href = `/astronaut_mission/mission_detail.html?uri=${encodeURIComponent(missionUri.trim())}`;
            link.textContent = missionName;
            link.classList.add("text-cyan-400", "hover:underline");
            listItem.appendChild(link);
            missionsListElement.appendChild(listItem);
        });
    } else {
        document.getElementById("missions-section").style.display = 'none'; // Masquer la section si aucune mission
    }

}

loadAstronautDetails();