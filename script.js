const API_BASE = "https://pokeapi.co/api/v2";
const POOL_SIZE = 20;

const typeColors = {
  normal: "#a8a878",
  fire: "#f08030",
  water: "#6890f0",
  electric: "#f8d030",
  grass: "#78c850",
  ice: "#98d8d8",
  fighting: "#c03028",
  poison: "#a040a0",
  ground: "#e0c068",
  flying: "#a890f0",
  psychic: "#f85888",
  bug: "#a8b820",
  rock: "#b8a038",
  ghost: "#705898",
  dragon: "#7038f8",
  dark: "#705848",
  steel: "#b8b8d0",
  fairy: "#ee99ac",
};

const quickStats = [
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "speed", label: "Speed" },
];

const allStats = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "special-attack", label: "Sp. Attack" },
  { key: "special-defense", label: "Sp. Defense" },
  { key: "speed", label: "Speed" },
];

const fetchPoolButton = document.querySelector("#fetch-pool");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#pokemon-search");
const statusMessage = document.querySelector("#status");
const poolSection = document.querySelector("#pool-section");
const pokemonGrid = document.querySelector("#pokemon-grid");
const spotlightSection = document.querySelector("#spotlight-section");
const spotlight = document.querySelector("#spotlight");

fetchPoolButton.addEventListener("click", loadRandomPool);
searchForm.addEventListener("submit", searchForPokemon);

async function loadRandomPool() {
  setLoading(true);
  setStatus("Shuffling a fresh draft pool…");
  poolSection.hidden = true;
  spotlightSection.hidden = true;
  pokemonGrid.replaceChildren();
  spotlight.replaceChildren();

  try {
    const catalog = await getPokemonCatalog();
    const picks = getRandomPokemonEntries(catalog, POOL_SIZE);
    const pokemon = await Promise.all(picks.map(({ name }) => fetchPokemon(name)));
    if (pokemon.some((entry) => entry === null)) {
      throw new Error("The Pokémon service returned an incomplete draft pool. Please try again.");
    }

    const cards = document.createDocumentFragment();
    pokemon.forEach((entry) => cards.append(createPokemonCard(entry)));
    pokemonGrid.replaceChildren(cards);
    poolSection.hidden = false;
    setStatus(`${POOL_SIZE} random Pokémon are ready for your draft.`);
  } catch (error) {
    setStatus(getErrorMessage(error, "Unable to load the draft pool. Check your connection and try again."), true);
  } finally {
    setLoading(false);
  }
}

async function searchForPokemon(event) {
  event.preventDefault();
  const searchTerm = searchInput.value.trim();
  if (!searchTerm) {
    setStatus("Enter a Pokémon name or Pokédex number to search.", true);
    return;
  }

  setLoading(true);
  setStatus(`Searching for ${searchTerm}…`);
  poolSection.hidden = true;
  spotlightSection.hidden = true;
  spotlight.replaceChildren();

  try {
    const pokemon = await fetchPokemon(toPokemonSlug(searchTerm));
    if (!pokemon) {
      setStatus(`No Pokémon named “${searchTerm}” was found. Check the spelling and try again.`, true);
      return;
    }

    spotlight.append(createPokemonCard(pokemon, true));
    spotlightSection.hidden = false;
    setStatus(`Showing the full battle profile for ${formatName(pokemon.name)}.`);
  } catch (error) {
    setStatus(getErrorMessage(error, "Unable to search right now. Check your connection and try again."), true);
  } finally {
    setLoading(false);
  }
}

async function getPokemonCatalog() {
  const response = await fetch(`${API_BASE}/pokemon?limit=100000`);
  if (!response.ok) {
    throw new Error(`The Pokémon service responded with ${response.status}.`);
  }
  const data = await response.json();
  if (!Array.isArray(data.results) || data.results.length < POOL_SIZE) {
    throw new Error("The Pokémon service returned too few entries to make a draft pool.");
  }
  return data.results;
}

async function fetchPokemon(nameOrId) {
  const response = await fetch(`${API_BASE}/pokemon/${encodeURIComponent(nameOrId)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`The Pokémon service responded with ${response.status}.`);
  }
  return response.json();
}

function getRandomPokemonEntries(catalog, count) {
  const candidates = [...catalog];
  for (let index = 0; index < count; index += 1) {
    const randomIndex = index + Math.floor(Math.random() * (candidates.length - index));
    [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
  }
  return candidates.slice(0, count);
}

function toPokemonSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[.\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createPokemonCard(pokemon, isSpotlight = false) {
  const pokemonTypes = Array.isArray(pokemon.types) ? pokemon.types : [];
  const primaryType = pokemonTypes[0]?.type?.name ?? "normal";
  const card = document.createElement("article");
  card.className = isSpotlight ? "pokemon-card pokemon-card--spotlight" : "pokemon-card";
  card.style.setProperty("--type-color", typeColors[primaryType] ?? typeColors.normal);

  const imageArea = document.createElement("div");
  imageArea.className = "pokemon-card__art";
  const image = document.createElement("img");
  image.alt = `${formatName(pokemon.name)} artwork`;
  image.loading = "lazy";
  const officialArtwork = pokemon.sprites.other?.["official-artwork"]?.front_default;
  const fallbackArtwork = pokemon.sprites.front_default;
  const imageSource = officialArtwork || fallbackArtwork;
  if (!imageSource) {
    imageArea.hidden = true;
  } else {
    image.src = imageSource;
    let usingFallback = imageSource === fallbackArtwork;
    image.addEventListener("error", () => {
      if (!usingFallback && fallbackArtwork) {
        usingFallback = true;
        image.src = fallbackArtwork;
      } else {
        imageArea.hidden = true;
      }
    });
    imageArea.append(image);
  }
  card.append(imageArea);

  const info = document.createElement("div");
  info.className = "pokemon-card__info";
  const topline = document.createElement("div");
  topline.className = "pokemon-card__topline";
  topline.textContent = `NO. ${String(pokemon.id).padStart(3, "0")}`;
  if (isSpotlight) {
    const label = document.createElement("span");
    label.textContent = "FULL BATTLE PROFILE";
    topline.append(label);
  }
  info.append(topline);

  const name = document.createElement("h3");
  name.className = "pokemon-card__name";
  name.textContent = formatName(pokemon.name);
  info.append(name);

  const types = document.createElement("div");
  types.className = "type-list";
  types.setAttribute("aria-label", "Types");
  types.setAttribute("role", "list");
  pokemonTypes.forEach(({ type }) => {
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = type.name;
    badge.setAttribute("role", "listitem");
    badge.style.setProperty("--type-color", typeColors[type.name] ?? typeColors.normal);
    types.append(badge);
  });
  info.append(types);

  if (isSpotlight) {
    const measurements = document.createElement("p");
    measurements.className = "pokemon-card__measurements";
    measurements.append(
      makeMeasurement("Height", `${(pokemon.height / 10).toFixed(1)} m`),
      makeMeasurement("Weight", `${(pokemon.weight / 10).toFixed(1)} kg`),
    );
    info.append(measurements);
  }

  const statList = document.createElement("dl");
  statList.className = "stat-list";
  const displayedStats = isSpotlight ? allStats : quickStats;
  displayedStats.forEach(({ key, label, shortLabel }) => {
    const stat = pokemon.stats.find((entry) => entry.stat.name === key);
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = shortLabel ?? label;
    definition.textContent = String(stat?.base_stat ?? "—");
    const statItem = document.createElement("div");
    statItem.className = "stat";
    statItem.append(term, definition);
    statList.append(statItem);
  });

  const statWrapper = document.createElement("div");
  statWrapper.className = isSpotlight ? "pokemon-card__stats" : "";
  statWrapper.append(statList);
  info.append(statWrapper);
  card.append(info);
  return card;
}

function makeMeasurement(label, value) {
  const wrapper = document.createElement("span");
  const emphasis = document.createElement("strong");
  emphasis.textContent = `${label}:`;
  wrapper.append(emphasis, document.createTextNode(value));
  return wrapper;
}

function formatName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function setLoading(isLoading) {
  fetchPoolButton.disabled = isLoading;
  searchInput.disabled = isLoading;
  searchForm.querySelector("button[type='submit']").disabled = isLoading;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("status--error", isError);
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}
