const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';

// Récupérer les paramètres de l'URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


// Fonction pour fetch les détails d'un astronaute en particulier 
async function loadMissionDetails() {
    missionURI = getQueryParam("uri")
    try {
        let query = `
            SELECT DISTINCT ?label ?abstract ?landingDate ?launchDate ?launchVehicle ?nextMission SAMPLE(?thumbnail) as ?img ?previousMission ?operator ?missionType  (GROUP_CONCAT(DISTINCT ?member; separator=", ") AS ?crewMember)
            WHERE {
            <${missionURI}> a dbo:SpaceMission ;
                    rdfs:label ?label ;
                    dbo:abstract ?abstract.

            OPTIONAL {<${missionURI}> dbo:landingDate ?landingDate. }
            OPTIONAL {<${missionURI}> foaf:depiction ?thumbnail. }
            OPTIONAL {<${missionURI}> dbo:crewMember ?member. }
            OPTIONAL {<${missionURI}> dbo:launchVehicle ?launchVehicle. }
            OPTIONAL {<${missionURI}> dbo:nextMission ?nextMission. }
            OPTIONAL {<${missionURI}> dbo:previousMission ?previousMission. }
            OPTIONAL {<${missionURI}> dbo:operator ?operator. }
            OPTIONAL {<${missionURI}> dbp:missionType ?missionType. }
            OPTIONAL {<${missionURI}> dbo:launchDate ?launchDate.}

            FILTER (lang(?label) = "en" && lang(?abstract) = "en")
            }
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
            showDetailsMission(result);
        } else {
            console.error("No details found for the mission.");
        }
    } catch (error) {
        console.error("Error loading mission details:", error);
    }
}

// Fonction pour afficher les détails dans le modal
function showDetailsMission(result) {
    const label = result.label?.value || 'No name';
    const abstract = result.abstract?.value || 'No description available';
    const crewMember = result.crewMember?.value || 'Unknown';
    const img = result.img?.value || 'default-mission.svg';
    const landingDate = result.landingDate?.value || 'Unknown';
    const launchDate = result.launchDate?.value || 'Unknown';
    const launchVehicle = result.launchVehicle?.value || 'Unknown';
    const nextMission = result.nextMission?.value || 'Unknown';
    const previousMission = result.previousMission?.value || 'Unknown';
    const operator = result.operator?.value || 'Unknown';
    const missionType = result.missionType?.value || 'Unknown';

    // Mise à jour des champs principaux
    document.getElementById("mission-img").src = img;
    document.getElementById("mission-img").alt = label;
    document.getElementById("mission-label").textContent = label;
    document.getElementById("mission-description").textContent = abstract;

    // Affichage conditionnel des sections
    if (landingDate !== 'Unknown') {
        document.getElementById("mission-landingDate").textContent = landingDate;
    } else {
        document.getElementById("mission-landingDate").parentElement.style.display = 'none';
    }

    if (launchDate !== 'Unknown') {
        document.getElementById("mission-launchDate").textContent = launchDate;
    } else {
        document.getElementById("mission-launchDate").parentElement.style.display = 'none';
    }

    if (launchVehicle !== 'Unknown') {
        document.getElementById("mission-launchVehicle").textContent = launchVehicle;
    } else {
        document.getElementById("mission-launchVehicle").parentElement.style.display = 'none';
    }

    if (operator !== 'Unknown') {
        document.getElementById("mission-operator").textContent = operator;
    } else {
        document.getElementById("mission-operator").parentElement.style.display = 'none';
    }

    if (missionType !== 'Unknown') {
        document.getElementById("mission-type").textContent = missionType;
    } else {
        document.getElementById("mission-type").parentElement.style.display = 'none';
    }

    // Gestion des équipages
    const crewListElement = document.getElementById("crew-list");
    crewListElement.innerHTML = ""; // Réinitialiser la liste
    if (crewMember !== 'Unknown') {
        const crewMemberList = crewMember.split(",");
        crewMemberList.forEach((astronautUri) => {
            const astronautName = astronautUri.split("/").pop().replace(/_/g, " ");
            const listItem = document.createElement("li");
            const link = document.createElement("a");
            link.href = `/astronaut_mission/astronaut_detail.html?uri=${encodeURIComponent(astronautUri)}`;
            link.textContent = astronautName;
            link.classList.add("text-cyan-400", "hover:underline");
            listItem.appendChild(link);
            crewListElement.appendChild(listItem);
        });
    } else {
        document.getElementById("mission-crew").parentElement.style.display = 'none';
    }

    // Gestion des missions précédentes et suivantes
    if (previousMission !== 'Unknown') {
        const previousMissionName = previousMission.split("/").pop().replace(/_/g, " ");
        const previousMissionLink = document.createElement("a");
        previousMissionLink.href = `/astronaut_mission/mission_detail.html?uri=${encodeURIComponent(previousMission)}`;
        previousMissionLink.textContent = previousMissionName;
        previousMissionLink.classList.add("text-cyan-400", "hover:underline");
        const previousMissionContainer = document.getElementById("mission-previousMission");
        previousMissionContainer.innerHTML = ""; // Réinitialiser
        previousMissionContainer.appendChild(previousMissionLink);
    } else {
        document.getElementById("mission-previousMission").parentElement.style.display = 'none';
    }

    if (nextMission !== 'Unknown') {
        const nextMissionName = nextMission.split("/").pop().replace(/_/g, " ");
        const nextMissionLink = document.createElement("a");
        nextMissionLink.href = `/astronaut_mission/mission_detail.html?uri=${encodeURIComponent(nextMission)}`;
        nextMissionLink.textContent = nextMissionName;
        nextMissionLink.classList.add("text-cyan-400", "hover:underline");
        const nextMissionContainer = document.getElementById("mission-nextMission");
        nextMissionContainer.innerHTML = ""; // Réinitialiser
        nextMissionContainer.appendChild(nextMissionLink);
    } else {
        document.getElementById("mission-nextMission").parentElement.style.display = 'none';
    }
}



loadMissionDetails();