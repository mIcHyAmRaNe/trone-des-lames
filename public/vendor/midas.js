(function () {

	/**
	 * Configuration des slots du corps (ceux des autres éléments sont en base), notamment de leurs zIndex et leur nom.
	 */
	const SLOTS = {
		"mainD": {
			nom: "MainD",
			zIndex: [
				2002,
				2003 // @TODO Mains /!\ A configurer quand on aura des postures "main droite" a deux calques
			]
		},
		"mainG": {
			nom: "MainG",
			zIndex: [ 
				14000, // Pouce
				17001 // Main
			]
		},
		"sousVetements": {
			nom: "SousVetements",
			zIndex: 2003
		},
		"visage": {
			nom: "Visage",
			zIndex: 7200
		},
		"cheveuxAvants": {
			nom: "CheveuxAvants",
			zIndex: 10000
		},
		"cheveuxIntermediaires": {
			nom: "CheveuxIntermediaires",
			zIndex: 7000
		},
		"cheveuxArrieres": {
			nom: "CheveuxArrieres",
			zIndex: 1500
		},
		"barbes": {
			nom: "Barbes",
			zIndex: 10001
		},
		"corps": {
			nom: "Corps",
			zIndex: 2000
		},
		"cheveux": {
			nom: "Cheveux",
			zIndex: 10000
		},
		"personnage": {
			nom: "Personnage",
			zIndex: 20000
		},
		"ombre": {
			nom: "Ombre",
			zIndex: 10
		}
	};

	/**
	 * Nombre de calques qui composent la posture d'une main
	 * Si la posture n'apparaît pas dans le tableau, elle ne contient qu'un calque
	 */
	const NB_CALQUES_MAIN = {
		"MainD": {
		},
		"MainG": {
			1: 2,
		}
	};

	const CHANGE_SIZE_EXCLUDED_SLOTS = [
		"Familier", 
		"Fond", 
		"Cadre",
	];

	const SKIN_SLOTS = [
		"corps",
		"visage",
		"cheveux",
	];

	const HAIR_SLOTS = ["cheveux"];

	const SLOTS_GARDE_ROBE = {
		BARBES: "Barbes",
		COIFFURES: "Coiffures",
	};

	/**
	 * Représente la liste des calques
	 */
	const ListeCalque = class {
		constructor() {
			this._calques = [];
			this._onLoad = () => { };
		}

		/**
		 * Ajoute un calque à la liste des calques
		 * @param {string} src la source de l'image à charger
		 * @param {*} zIndex le zIndex de l'image
		 * @param {string} tag
		 * @param {int} posX pour override la position X du calque
		 * @param {int} posY pour override la position Y du calque
		 */
		ajouteCalque(src, zIndex, tag, posX = 0, posY = 0) {
			this._calques.push({
				src: src,
				zIndex: zIndex,
				tag: tag,
				posX: posX,
				posY: posY
			});
		}

		/**
		 * Génère le canvas et dessine les calques dedans
		 * @param {Array} infosContexte les infos du contexte
		 * @returns {Promise<CanvasRenderingContext2D>} une promesse résolvant le canvas.
		 */
		genereCanvas(infosContexte) {

			let resolution = infosContexte.resolution;

			if(typeof resolution == 'string')
			{
				if(resolution == "_@4X")
					resolution = 4;
				if(resolution == "_@2X")
					resolution = 2;
				else
					resolution = 1;
			}

			let canvas = document.createElement("canvas");
			let context = canvas.getContext("2d");
			canvas.classList.add("apercu_personnage_rar__calque");
			canvas.width = resolution * 256;
			canvas.height = resolution * 512;
			context.midasResolution = resolution;
			return this.dessineCanvas(canvas, context, infosContexte);
		}

		/**
		 * Dessine l'avatar dans un canvas et renvoie une promesse résolvant le canvas.
		 * @param {HTMLCanvasElement} canvas 
		 * @param {CanvasRenderingContext2D} context 
		 * @param {Array} infosContexte
		 * @returns {Promise<CanvasRenderingContext2D>} une promesse résolvant le canvas.
		 */
		dessineCanvas(canvas, context, infosContexte) {
			// Tri par zindex
			this._calques.sort((a, b) => { return a.zIndex - b.zIndex });

			// Chargement des images
			let promises = [];
			for (let calque of this._calques) {
				promises.push(new Promise((accept, reject) => {
					calque.img = document.createElement("img");
					calque.img.onerror = () => {
						calque.ok = false;
						accept();
					};
					calque.img.ontimeout = () => {
						calque.ok = false;
						accept();
					};
					calque.img.onload = () => {
						calque.ok = true;
						accept();
					};
					// rk_wardrobe patch: the calque CDN sends Access-Control-Allow-Origin: *,
					// so opting in keeps the canvas untainted and toDataURL("image/png")
					// works for outfit export. Without it the canvas is tainted by the
					// cross-origin images and export throws a SecurityError.
					calque.img.crossOrigin = "anonymous";
					calque.img.src = calque.src;
				}));
			}
			let promise = Promise.all(promises);

			// Observateur onLoad
			promise = promise.then(() => {
				return this._onLoad();
			});

			// Dessin du canvas
			promise = promise.then(() => {
				for (let calque of this._calques) {
					if (calque.ok) {
						// Default values
						let tailleModificateur = 1;
						context.filter = "none";

						// Alterations
						for (let alteration of infosContexte.alterationsMidas) {
							switch (alteration.Type) {
								case "changeSize":
									if (!CHANGE_SIZE_EXCLUDED_SLOTS.includes(calque.tag)) {
										tailleModificateur = alteration.Value;
									}
									break;
								case "changeSkinColor":
									if (SKIN_SLOTS.includes(calque.tag)) {
										if (alteration.Value == "green") context.filter = "contrast(1.1) sepia(1) hue-rotate(1500deg)";
										else if (alteration.Value == "blue") context.filter = "contrast(1.1) sepia(1) hue-rotate(150deg)";
									}
									break;
								case "changeHairColor":
									if (HAIR_SLOTS.includes(calque.tag)) {
										if (alteration.Value == "green") context.filter = "contrast(1.1) sepia(1) hue-rotate(1500deg) brightness(0.6)";
									}
									break;
								case "grayscale":
									if (["Fond", "Cadre"].includes(calque.tag))
										context.filter = "grayscale(1)";
									break;
							}
						}

						// Compute size and draw image
						let newWidth = canvas.width * tailleModificateur;
						let newHeight = canvas.height * tailleModificateur;

						let posX = (canvas.width - newWidth) * 0.5 + calque.posX * context.midasResolution; // *0.5 pour centrer
						let posY = (canvas.height - newHeight) + calque.posY * context.midasResolution; // en bas

						context.drawImage(calque.img, posX, posY, newWidth, newHeight);
					}
				}
			});

			promise.catch((e)=>{
				RAR.error(e);
			});

			return promise.then(()=>{return canvas;});
		}

		/**
		 * Définis une callback appelée à la fin du chargement des images
		 * @param {function} callback la fonction de callback a appeler une fois le chargement des images terminés
		 */
		setOnLoad(callback) {
			this._onLoad = callback;
		}

		/**
		 * Renvoi la liste des calques associés à un tag en particulier
		 * @param {string} tag le tag recherché
		 */
		getCalquesAvecTag(tag) {
			let calquesAvecTag = [];
			for(let calque of this._calques)
			{
				if(calque.tag == tag)
					calquesAvecTag.push(calque);
			}
			return calquesAvecTag;
		}

		/**
		 * Désactive tous les calques associés à un tag
		 * @param {string} tag le tag recherché
		 */
		desactiveCalquesAvecTag(tag) {
			for(let calque of this._calques)
			{
				if(calque.tag == tag)
					calque.ok = false;
			}
		}
	};

	/**
	 * Gère la génération des protraits et des aperçus des personnages
	 */
	const Midas = class {
		/**
		 * Génère un aperçu d'un personnage
		 * @param {HTMLElement} racine l'objet DOM contenant le personnage
		 * @param {function} [callback] une callback appelée une fois le portrait généré
		 */
		static genereApercu(racine, callback) {
			return this._getFormat().then((format) => {
				if (racine.classList.contains("apercu_personnage_rar__affiche") || racine.classList.contains("apercu_personnage_rar__generation"))
					return Promise.resolve(); //L'aperçu a déjà été généré
					
				// Récupération des informations de l'aperçu
				let infosApercu = {
					login: "",
					sexe: "M",
					codeVisage: "M00000000000000000000",
					equipement: []
				};
				try {
					infosApercu = JSON.parse(racine.innerHTML);
					racine.innerHTML = "";
				}
				catch (e) {
					RAR.error(e, racine.innerHTML);
				}

				// Génération de l'aperçu
				this._genereApercu(racine, infosApercu, null).then(()=>{
					if(callback)
						callback(racine);
				});
			});
		}

		/**
		 * Génère un apercu de personnage en créan la div conteneur depuis un json de Midas
		 * @param {string} json le json du portrait
		 * @param {boolean} mini si vrai, il faut la version mini
		 * @param {string[]} [slotsMasques] un tableau contenant la liste des slots à masquer
		 * @param {function} [callback] une callback appelée une fois le portrait généré
		 * @returns {HTMLDivElement} la div contenant le personnage générée
		 */
		static genereApercuDepuisJSON(json, mini, slotsMasques, callback) {
			slotsMasques = slotsMasques || [];

			// Récupération des informations de l'aperçu
			let infosApercu = {
				login: "",
				sexe: "M",
				codeVisage: "M00000000000000000000",
				equipement: []
			};
			try {
				infosApercu = JSON.parse(json);
			}
			catch (e) {
				RAR.error(e, json);
			}

			// Construction de la div racine
			let racine = document.createElement("div");
			racine.classList.add("apercu_personnage_rar");
			if (mini) {
				racine.classList.add("apercu_personnage_rar__mini");			
			}
			if (infosApercu.sexe == "M")
				racine.classList.add("apercu_personnage_rar__homme");
			else
				racine.classList.add("apercu_personnage_rar__femme");

			// Génération de l'aperçu
			this._genereApercu(racine, infosApercu, slotsMasques).then(()=>{
				if(callback)
					callback(racine);
			});

			return racine;
		}

		/**
		 * Génère tous les aperçus présent à l'intérieur de l'objet DOM donné en paramètre.
		 * @param {HTMLElement} racine l'objet DOM dans lequel il faut générer tous les aperçus.
		 * @param {string} resolution string qui représente la résolution que l'on veut forcer à afficher
		 */
		static genereTousLesApercus(racine, resolution) {
			if(resolution)
				RAR.Midas.resolution = resolution;
			let elements = racine.querySelectorAll(".apercu_personnage_rar");
			for (let element of elements) {
				this.genereApercu(element);
			}
		}

		/**
		 * @param {HTMLDivElement} racine la racine dom dans laquelle générer le portrait
		 * @param {*} infosApercu les informations pour lé génération de l'aperçu
		 * @param {string[]} [slotsMasques] un tableau contenant la liste des slots à masquer
		 */
		static _genereApercu(racine, infosApercu, slotsMasques) {
			slotsMasques = slotsMasques || [];
			if (racine.classList.contains("apercu_personnage_rar__affiche") || racine.classList.contains("apercu_personnage_rar__generation"))
				return Promise.resolve(); //L'aperçu a déjà été généré
			racine.classList.add("apercu_personnage_rar__generation");
			let contexte = this._genereContexte(infosApercu.login, infosApercu.sexe, infosApercu.codeVisage, infosApercu.equipement, infosApercu.alterationsMidas);
			let listeCalque = new ListeCalque();

			return this._getFormat().then((format) => {
				contexte.format = format;
				contexte.resolution = RAR.Midas.resolution;
				for(let slotAMasquer of slotsMasques)
					contexte.slotsMasques[slotAMasquer] = slotAMasquer;
			}).then(() => {
				this._genereCorps(listeCalque, contexte);
				if (contexte.sexe == "F" && contexte.barbe > 0) {

				}
				for (let item of infosApercu.equipement)
					this._genereEquipement(listeCalque, contexte, item);

				return listeCalque.genereCanvas(contexte);
			}).then((canvas) => {
				racine.appendChild(canvas);
				racine.classList.remove("apercu_personnage_rar__generation");
				racine.classList.add("apercu_personnage_rar__affiche");
			});
		}

		/**
		 * Génère le corps du personnage
		 * @param {ListeCalque} listeCalque La liste des calques
		 * @param {Object} contexte Le contexte du personnage
		 */
		static _genereCorps(listeCalque, contexte) {
			if (contexte.slotsMasques[SLOTS.personnage.nom])
				return;

			let racineImages = this._getRacineImages(contexte.sexe) + "corps/";

			if (!contexte.slotsMasques[SLOTS.mainG.nom]) {
				const posture = contexte.postureMainG;
				const nbCalques = NB_CALQUES_MAIN[SLOTS.mainG.nom][posture] ?? 1;
				if (nbCalques > 1) {
					for (let i = 0; i < nbCalques; i++) {
						listeCalque.ajouteCalque(`${racineImages}mainGauche_p${contexte.couleurPeau}_m${contexte.postureMainG}_${i}${contexte.resolution}.${contexte.format}`, SLOTS.mainG.zIndex[i], "corps");
					}
				} else {
					listeCalque.ajouteCalque(`${racineImages}mainGauche_p${contexte.couleurPeau}_m${contexte.postureMainG}${contexte.resolution}.${contexte.format}`, SLOTS.mainG.zIndex[0], "corps");
				}
			}
			if (!contexte.slotsMasques[SLOTS.mainD.nom]) {
				const posture = contexte.postureMainD;
				const nbCalques = NB_CALQUES_MAIN[SLOTS.mainD.nom][posture] ?? 1;
				if (nbCalques > 1) {
					for (let i = 0; i < nbCalques; i++) {
						listeCalque.ajouteCalque(`${racineImages}mainDroite_p${contexte.couleurPeau}_m${contexte.postureMainD}_${i}${contexte.resolution}.${contexte.format}`, SLOTS.mainD.zIndex[i], "corps");
					}
				} else {
					listeCalque.ajouteCalque(`${racineImages}mainDroite_p${contexte.couleurPeau}_m${contexte.postureMainD}${contexte.resolution}.${contexte.format}`, SLOTS.mainD.zIndex[0], "corps");
				}
			}
			if (!contexte.slotsMasques[SLOTS.cheveuxAvants.nom] && !contexte.slotsMasques[SLOTS.cheveux.nom])
				listeCalque.ajouteCalque(`${racineImages}cheveuxAvants_${contexte.cheveux}_c${contexte.couleurCheveux}${contexte.resolution}.${contexte.format}`, SLOTS.cheveuxAvants.zIndex, "cheveux");
			if (!contexte.slotsMasques[SLOTS.visage.nom]) {
				listeCalque.ajouteCalque(`${racineImages}marques_${contexte.marques}_p${contexte.couleurPeau}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex + 6, "visage");
				listeCalque.ajouteCalque(`${racineImages}sourcils_${contexte.sourcils}_c${contexte.couleurSourcils}_e${contexte.emotions.sourcils}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex + 5, "visage");
				listeCalque.ajouteCalque(`${racineImages}yeux_${contexte.yeux}_p${contexte.couleurPeau}_e${contexte.emotions.yeux}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex + 4, "visage");
				listeCalque.ajouteCalque(`${racineImages}iris_0_c${contexte.couleurYeux}_e${contexte.emotions.iris}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex + 3, "visage");
				listeCalque.ajouteCalque(`${racineImages}nez_${contexte.nez}_p${contexte.couleurPeau}_e${contexte.emotions.nez}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex + 2, "visage");
				listeCalque.ajouteCalque(`${racineImages}bouche_${contexte.bouche}_c${contexte.couleurBouche}_p${contexte.couleurPeau}_e${contexte.emotions.bouche}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex + 1, "visage");
				listeCalque.ajouteCalque(`${racineImages}visage_${contexte.visage}_p${contexte.couleurPeau}${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex, "visage");
			}
			if (!contexte.slotsMasques[SLOTS.sousVetements.nom])
				listeCalque.ajouteCalque(`${racineImages}sousVetements${contexte.resolution}.${contexte.format}`, SLOTS.sousVetements.zIndex, "corps");
			if (!contexte.slotsMasques[SLOTS.corps.nom])
				listeCalque.ajouteCalque(`${racineImages}corps_p${contexte.couleurPeau}${contexte.resolution}.${contexte.format}`, SLOTS.corps.zIndex, "corps");
			if (!contexte.slotsMasques[SLOTS.ombre.nom])
				listeCalque.ajouteCalque(`${racineImages}ombre${contexte.resolution}.${contexte.format}`, SLOTS.ombre.zIndex, "corps");

			// Gestion des portraits personnalisés
			if (contexte.portraitPersonnalise && contexte.login) {
				listeCalque.ajouteCalque(`${RAR.Midas.racine}/portraitsPersonnalises/${contexte.login}_0${contexte.resolution}.${contexte.format}`, SLOTS.cheveuxArrieres.zIndex, "visagePersonnalise");
				listeCalque.ajouteCalque(`${RAR.Midas.racine}/portraitsPersonnalises/${contexte.login}_1${contexte.resolution}.${contexte.format}`, SLOTS.visage.zIndex, "visagePersonnalise");
				listeCalque.setOnLoad(() => {
					let calquesVisagePerso = listeCalque.getCalquesAvecTag("visagePersonnalise");
					let ok = true;
					for(let calque of calquesVisagePerso)
						if(!calque.ok)
							ok=false;
					if(ok)
						listeCalque.desactiveCalquesAvecTag("visage");
					else
						listeCalque.desactiveCalquesAvecTag("visagePersonnalise");
				});
			}
		}

		/**
		 * Génère les vêtements et autres équipement du personnage
		 * @param {ListeCalque} listeCalque La liste des calques
		 * @param {Object} contexte le contexte du personnage
		 * @param {Object[]} item la liste des items portés par le personnage
		 */
		static _genereEquipement(listeCalque, contexte, item) {
			if (contexte.slotsMasques[item.slot])
				return;

			if (item.slot == SLOTS_GARDE_ROBE.COIFFURES) {
				let racineImages = this._getRacineImages(contexte.sexe) + 'corps/';
				let idCoiffure = item.nom.replace(/\D/g, ''); // On ne récupère que l'ID de la coiffure
				if (!contexte.slotsMasques[SLOTS.cheveuxAvants.nom] && !contexte.slotsMasques[SLOTS.cheveux.nom])
					listeCalque.ajouteCalque(`${racineImages}cheveuxAvants_${idCoiffure}_c${contexte.couleurCheveux}${contexte.resolution}.${contexte.format}`, SLOTS.cheveuxAvants.zIndex, "cheveux");
				if (!contexte.slotsMasques[SLOTS.cheveuxIntermediaires.nom] && !contexte.slotsMasques[SLOTS.cheveux.nom])
					listeCalque.ajouteCalque(`${racineImages}cheveuxIntermediaires_${idCoiffure}_c${contexte.couleurCheveux}${contexte.resolution}.${contexte.format}`, SLOTS.cheveuxIntermediaires.zIndex, "cheveux");
				if (!contexte.slotsMasques[SLOTS.cheveuxArrieres.nom] && !contexte.slotsMasques[SLOTS.cheveux.nom])
					listeCalque.ajouteCalque(`${racineImages}cheveuxArrieres_${idCoiffure}_c${contexte.couleurCheveux}${contexte.resolution}.${contexte.format}`, SLOTS.cheveuxArrieres.zIndex, "cheveux");
			}
			else if (item.slot == SLOTS_GARDE_ROBE.BARBES) {
				let [idBarbe, expression] = item.nom.match(/\d+/g).map(Number); // On récupère les valeurs numériques qui correspondent à l'idBarbe et l'expression
				if (!expression) expression = 0;
				if (!contexte.slotsMasques[SLOTS.visage.nom]) {
					if (idBarbe > 0) {
						let racineImagesBarbe = `${this._getRacineImages()}hommes/corps/`;
						let calqueBarbePosX = 0;
						let calqueBarbePosY = 0;
						if (contexte.sexe == "F") {
							calqueBarbePosX = 7;
							calqueBarbePosY = 21;
						}
						listeCalque.ajouteCalque(`${racineImagesBarbe}barbe_${idBarbe}_c${contexte.couleurBarbe}_e${expression}${contexte.resolution}.${contexte.format}`, SLOTS.barbes.zIndex + 7, "visage", calqueBarbePosX, calqueBarbePosY);
					}
				}
			}
			else { // Slots d'équipements
				for (let i = 0; i < item.zIndexCalques.length; i++) {
					let zIndex = item.zIndexCalques[i];
					let src = this._getSrcEquipement(contexte, item, i);
					listeCalque.ajouteCalque(src, zIndex, item.slot);
				}
			}
		}

		/**
		 * Retourne le lien racine des images Midas, en fonction du sexe du personnage s'il est renseigné
		 * 
		 * @param {string|null} sexe Le sexe du personnage ("M" ou "F") ou null
		 * @returns Lien racine des images Midas
		 */
		static _getRacineImages(sexe = null) {
			let racineImages = RAR.Midas.racine;
			if (!sexe) return racineImages;
			if (sexe == "F")
				racineImages += "femmes/";
			else
				racineImages += "hommes/";
			return racineImages;
		}

		/**
		 * Génère le contexte du personnage
		 * 
		 * @param {string} login Le login du personnage
		 * @param {string} sexe Le sexe du personnage ("M" ou "F")
		 * @param {string} codeVisage Le code visage du personnage
		 * @param {object[]} items La liste des items du personnage
		 */
		static _genereContexte(login, sexe, codeVisage, items, alterationsMidas = []) {
			let contexte = {
				login: login.toLowerCase(),
				sexe: sexe,
				alterationsMidas: alterationsMidas,
				portraitPersonnalise: codeVisage[0] == "P",
				visage: codeVisage[1] || 0,
				couleurPeau: codeVisage[2] || 0,
				marques: codeVisage[3] || 0,
				sourcils: codeVisage[4] || 0,
				couleurSourcils: codeVisage[5] || 0,
				yeux: codeVisage[6] || 0,
				couleurYeux: codeVisage[7] || 0,
				nez: codeVisage[8] || 0,
				bouche: codeVisage[9] || 0,
				couleurBouche: codeVisage[10] || 0,
				cheveux: codeVisage[11] || 0,
				couleurCheveux: codeVisage[12] || 0,
				barbe: codeVisage[13] || 0,
				couleurBarbe: codeVisage[14] || 0,
				emotions: {
					sourcils: codeVisage[15] || 0,
					yeux: codeVisage[16] || 0,
					iris: codeVisage[17] || 0,
					nez: codeVisage[18] || 0,
					bouche: codeVisage[19] || 0,
					barbe: codeVisage[20] || 0
				},
				postureMainG: 0,
				postureMainD: 0,
				slotsMasques: {},
				format: RAR.Midas.format
			};
			for (let item of items) {
				if (item.postureMainG !== null && item.postureMainG !== 0)
					contexte.postureMainG = item.postureMainG;
				if (item.postureMainD !== null && item.postureMainD !== 0)
					contexte.postureMainD = item.postureMainD;
				for (let slot of item.slotsMasques) {
					let correspondances = slot.match(/([MF]_)(.*)/);
					if (correspondances) {
						if (correspondances[1] == sexe + "_")
							contexte.slotsMasques[correspondances[2]] = correspondances[2];
					}
					else
						contexte.slotsMasques[slot] = slot;
				}
			}
			return contexte;
		}

		/**
		 * Récupère le format des images à charger
		 * @returns {Promise} une promise résolvant le format.
		 */
		static _getFormat() {
			if (RAR.Midas.format != null)
				return Promise.resolve(RAR.Midas.format);
			return new Promise((resolve, reject) => {
				var kTestImages = {
					lossy: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
					lossless: "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
					alpha: "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==",
					animation: "UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA"
				};
				var img = new Image();
				img.onload = () => {
					if ((img.width > 0) && (img.height > 0)) {
						this._setFormat("webp");
						resolve("webp");
					}
					else {
						this._setFormat("png");
						resolve("png");
					}
				};
				img.onerror = () => {
					this._setFormat("png");
					resolve("png");
				};
				img.src = "data:image/webp;base64," + kTestImages["alpha"];
			});
		}

		/**
		 * Définit le format à utiliser
		 * @param {string} format Le format
		 */
		static _setFormat(format) {
			localStorage["midas.format"] = format;
			RAR.Midas.format = format;
		}

		static getImageDansJSON(json, slot) {
			var infosApercu = JSON.parse(json);
			let contexte = this._genereContexte(infosApercu.login, infosApercu.sexe, infosApercu.codeVisage, infosApercu.equipement, infosApercu.alterationsMidas);
			return this._getFormat().then((format) => {
				contexte.format = format;
				contexte.resolution = RAR.Midas.resolution;
				for (let item of infosApercu.equipement) {
					if (item.slot == slot)
						return this._getSrcEquipement(contexte, item);
				}
			})
		}

		static _getSrcEquipement(contexte, item, i = 0) {
			let nom = item.nom;
			if (item.declinaison && item.declinaison > 0)
				nom += `_d${item.declinaison}`;
			if (item.dependCouleurPeau)
				nom += `_p${contexte.couleurPeau}`;
			if (item.dependPostureMainG)
				nom += `_m${contexte.postureMainG}`;
			if (item.dependPostureMainD)
				nom += `_n${contexte.postureMainD}`;
			nom += `_${i}`;

			
			let src = `${this._getRacineImages(contexte.sexe)}/vetements/${nom}${contexte.resolution}.${contexte.format}`;
			if (item.slot == "Fond")
				src = `${this._getRacineImages()}fonds/${nom}${contexte.resolution}.${contexte.format}`;
			else if (item.slot == "Cadre")
				src = `${this._getRacineImages()}cadres/${nom}${contexte.resolution}.${contexte.format}`;

			return src;
		}

		
		/**
		 * Libère la mémoire des canvas de type aperçu Midas d'un élément DOM
		 * @param {HTMLElement} racine Racine DOM de la page où l'on libère détruit les canvas
		 */
		static detruitApercus(racine) {
			if(!racine || !racine.querySelectorAll)
				return;
			let canvases = racine.querySelectorAll(".apercu_personnage_rar canvas");
			for (let canvas of canvases) {
				let context = canvas.getContext("2d");
				canvas.width = 1;
				canvas.height = 1;
				context.clearRect(0, 0, 1, 1);
			}
		}
	};

	if (!window.RAR)
		window.RAR = {};
	RAR.Midas = Midas;

	if(!RAR.error)
		RAR.error = (...args) => console.error.apply(console, args);

	if (localStorage["midas.format"])
		RAR.Midas.format = localStorage["midas.format"];
	else
		RAR.Midas.format = null;

	if (typeof CelsiusDevice !== "undefined" && CelsiusDevice.hasOwnProperty('fetchInfos')) {
		CelsiusDevice.fetchInfos().then(() => {
			// @FIX TEMPORAIRE POUR L'AFFICHAGE DES YEUX SOUS IOS
			if (CelsiusDevice.getPlateforme() == 'ios' && Midas.format === 'webp')
				RAR.Midas.format = 'png';
		});
	}

	if (localStorage["paquet.resolution"] == 2) {
		RAR.Midas.resolution = "_@2X";
	} else {
		RAR.Midas.resolution = "_@1X";
	}

	RAR.Midas.racine = "./images/personnages_midas/";
	if (RAR.config && RAR.config.racineImagesCdn)
		RAR.Midas.racine = RAR.config.racineImagesCdn + 'personnages_midas/';

})();