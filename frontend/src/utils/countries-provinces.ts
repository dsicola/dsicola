// Estrutura estática de países e províncias CPLP
export const COUNTRIES_PROVINCES: Record<string, string[]> = {
  "Angola": [
    "Bengo",
    "Benguela",
    "Bié",
    "Cabinda",
    "Cuando-Cubango",
    "Cuanza Norte",
    "Cuanza Sul",
    "Cunene",
    "Huambo",
    "Huíla",
    "Luanda",
    "Lunda Norte",
    "Lunda Sul",
    "Malanje",
    "Moxico",
    "Namibe",
    "Uíge",
    "Zaire"
  ],
  "Brasil": [
    "Acre",
    "Alagoas",
    "Amapá",
    "Amazonas",
    "Bahia",
    "Ceará",
    "Distrito Federal",
    "Espírito Santo",
    "Goiás",
    "Maranhão",
    "Mato Grosso",
    "Mato Grosso do Sul",
    "Minas Gerais",
    "Pará",
    "Paraíba",
    "Paraná",
    "Pernambuco",
    "Piauí",
    "Rio de Janeiro",
    "Rio Grande do Norte",
    "Rio Grande do Sul",
    "Rondônia",
    "Roraima",
    "Santa Catarina",
    "São Paulo",
    "Sergipe",
    "Tocantins"
  ],
  "Portugal": [
    "Aveiro",
    "Beja",
    "Braga",
    "Bragança",
    "Castelo Branco",
    "Coimbra",
    "Évora",
    "Faro",
    "Guarda",
    "Leiria",
    "Lisboa",
    "Portalegre",
    "Porto",
    "Santarém",
    "Setúbal",
    "Viana do Castelo",
    "Vila Real",
    "Viseu",
    "Açores",
    "Madeira"
  ],
  "Moçambique": [
    "Cabo Delgado",
    "Gaza",
    "Inhambane",
    "Manica",
    "Maputo",
    "Maputo (Cidade)",
    "Nampula",
    "Niassa",
    "Sofala",
    "Tete",
    "Zambézia"
  ],
  "Cabo Verde": [
    "Barlavento",
    "Sotavento",
    "Ilhas do Barlavento: Santo Antão",
    "Ilhas do Barlavento: São Vicente",
    "Ilhas do Barlavento: São Nicolau",
    "Ilhas do Barlavento: Sal",
    "Ilhas do Barlavento: Boa Vista",
    "Ilhas do Sotavento: Maio",
    "Ilhas do Sotavento: Santiago",
    "Ilhas do Sotavento: Fogo",
    "Ilhas do Sotavento: Brava"
  ],
  "Guiné-Bissau": [
    "Bafatá",
    "Biombo",
    "Bissau",
    "Bolama",
    "Cacheu",
    "Gabú",
    "Oio",
    "Quinara",
    "Tombali"
  ],
  "São Tomé e Príncipe": [
    "Água Grande",
    "Cantagalo",
    "Caué",
    "Lembá",
    "Lobata",
    "Mé-Zóchi",
    "Príncipe"
  ],
  "Timor-Leste": [
    "Aileu",
    "Ainaro",
    "Baucau",
    "Bobonaro",
    "Cova-Lima",
    "Dili",
    "Ermera",
    "Lautém",
    "Liquiçá",
    "Manatuto",
    "Manufahi",
    "Oecusse",
    "Viqueque"
  ],
  "Guiné Equatorial": [
    "Annobón",
    "Bioko Norte",
    "Bioko Sur",
    "Centro Sur",
    "Kié-Ntem",
    "Litoral",
    "Wele-Nzas"
  ]
};

export const COUNTRIES = Object.keys(COUNTRIES_PROVINCES);

export const getProvincesByCountry = (country: string): string[] => {
  return COUNTRIES_PROVINCES[country] || [];
};

// Estrutura estática de municípios por província (foco em Angola)
export const PROVINCES_MUNICIPIOS: Record<string, Record<string, string[]>> = {
  "Angola": {
    "Luanda": [
      "Belas",
      "Cacuaco",
      "Cazenga",
      "Ícolo e Bengo",
      "Luanda",
      "Quiçama",
      "Viana"
    ],
    "Benguela": [
      "Balombo",
      "Baía Farta",
      "Bocoio",
      "Caimbambo",
      "Catumbela",
      "Chongoroi",
      "Cubal",
      "Ganda",
      "Lobito"
    ],
    "Huambo": [
      "Bailundo",
      "Cachiungo",
      "Caála",
      "Ecunha",
      "Huambo",
      "Londuimbali",
      "Longonjo",
      "Mungo",
      "Chicala-Choloanga",
      "Chinjenje",
      "Ucuma"
    ],
    "Huíla": [
      "Caconda",
      "Cacula",
      "Caluquembe",
      "Chiange",
      "Chibia",
      "Chicomba",
      "Chipindo",
      "Cuvango",
      "Humpata",
      "Jamba",
      "Lubango",
      "Matala",
      "Quilengues",
      "Quipungo"
    ],
    "Bié": [
      "Andulo",
      "Camacupa",
      "Catabola",
      "Chinguar",
      "Chitembo",
      "Cuemba",
      "Cunhinga",
      "Cuito",
      "Nharea"
    ],
    "Cabinda": [
      "Belize",
      "Buco-Zau",
      "Cabinda",
      "Cacongo"
    ],
    "Cuando-Cubango": [
      "Calai",
      "Cuangar",
      "Cuchi",
      "Cuito Cuanavale",
      "Dirico",
      "Mavinga",
      "Menongue",
      "Nancova",
      "Rivungo"
    ],
    "Cuanza Norte": [
      "Ambaca",
      "Banga",
      "Bolongongo",
      "Cambambe",
      "Cazengo",
      "Golungo Alto",
      "Gonguembo",
      "Lucala",
      "Quiculungo",
      "Samba Caju"
    ],
    "Cuanza Sul": [
      "Amboim",
      "Cassongue",
      "Cela",
      "Conda",
      "Ebo",
      "Libolo",
      "Mussende",
      "Porto Amboim",
      "Quibala",
      "Quilenda",
      "Seles",
      "Sumbe"
    ],
    "Cunene": [
      "Cahama",
      "Cuanhama",
      "Curoca",
      "Cuvelai",
      "Namacunde",
      "Ombadja"
    ],
    "Lunda Norte": [
      "Cambulo",
      "Capenda-Camulemba",
      "Caungula",
      "Chitato",
      "Cuango",
      "Cuílo",
      "Lóvua",
      "Lubalo",
      "Lucapa",
      "Xá-Muteba"
    ],
    "Lunda Sul": [
      "Cacolo",
      "Dala",
      "Muconda",
      "Saurimo"
    ],
    "Malanje": [
      "Cacuso",
      "Calandula",
      "Cambundi-Catembo",
      "Cangandala",
      "Caombo",
      "Cuaba Nzogo",
      "Cunda-dia-Baze",
      "Luquembo",
      "Malanje",
      "Marimba",
      "Massango",
      "Mucari",
      "Quela",
      "Quirima"
    ],
    "Moxico": [
      "Alto Zambeze",
      "Bundas",
      "Camanongue",
      "Léua",
      "Luau",
      "Luacano",
      "Luchazes",
      "Cameia",
      "Moxico"
    ],
    "Namibe": [
      "Bibala",
      "Camucuio",
      "Namibe",
      "Tômbua",
      "Virei"
    ],
    "Uíge": [
      "Alto Cauale",
      "Ambuíla",
      "Bembe",
      "Buengas",
      "Bungo",
      "Damba",
      "Milunga",
      "Mucaba",
      "Negage",
      "Puri",
      "Quimbele",
      "Quitexe",
      "Sanza Pombo",
      "Songo",
      "Uíge",
      "Zombo"
    ],
    "Zaire": [
      "Cuimba",
      "Mabanza Congo",
      "Nóqui",
      "Nezeto",
      "Soio",
      "Tomboco"
    ],
    "Bengo": [
      "Ambriz",
      "Bula Atumba",
      "Dande",
      "Dembos",
      "Nambuangongo",
      "Pango Aluquém"
    ]
  },
  "Brasil": {
    "São Paulo": [
      "São Paulo",
      "Campinas",
      "Guarulhos",
      "São Bernardo do Campo",
      "Santo André",
      "Osasco",
      "Ribeirão Preto",
      "Sorocaba",
      "Santos",
      "Mauá"
    ],
    "Rio de Janeiro": [
      "Rio de Janeiro",
      "São Gonçalo",
      "Duque de Caxias",
      "Nova Iguaçu",
      "Niterói",
      "Campos dos Goytacazes",
      "Belford Roxo",
      "São João de Meriti",
      "Petrópolis",
      "Volta Redonda"
    ],
    "Minas Gerais": [
      "Belo Horizonte",
      "Uberlândia",
      "Contagem",
      "Juiz de Fora",
      "Betim",
      "Montes Claros",
      "Ribeirão das Neves",
      "Uberaba",
      "Governador Valadares",
      "Ipatinga"
    ],
    "Bahia": [
      "Salvador",
      "Feira de Santana",
      "Vitória da Conquista",
      "Camaçari",
      "Juazeiro",
      "Ilhéus",
      "Itabuna",
      "Jequié",
      "Alagoinhas",
      "Barreiras"
    ],
    "Paraná": [
      "Curitiba",
      "Londrina",
      "Maringá",
      "Ponta Grossa",
      "Cascavel",
      "São José dos Pinhais",
      "Foz do Iguaçu",
      "Colombo",
      "Guarapuava",
      "Paranaguá"
    ],
    "Rio Grande do Sul": [
      "Porto Alegre",
      "Caxias do Sul",
      "Pelotas",
      "Canoas",
      "Santa Maria",
      "Gravataí",
      "Viamão",
      "Novo Hamburgo",
      "São Leopoldo",
      "Rio Grande"
    ],
    "Pernambuco": [
      "Recife",
      "Jaboatão dos Guararapes",
      "Olinda",
      "Caruaru",
      "Petrolina",
      "Paulista",
      "Cabo de Santo Agostinho",
      "Camaragibe",
      "Garanhuns",
      "Vitória de Santo Antão"
    ],
    "Ceará": [
      "Fortaleza",
      "Caucaia",
      "Juazeiro do Norte",
      "Maracanaú",
      "Sobral",
      "Crato",
      "Itapipoca",
      "Maranguape",
      "Iguatu",
      "Quixadá"
    ],
    "Pará": [
      "Belém",
      "Ananindeua",
      "Marabá",
      "Paragominas",
      "Castanhal",
      "Abaetetuba",
      "Cametá",
      "Bragança",
      "Altamira",
      "Santarém"
    ],
    "Santa Catarina": [
      "Florianópolis",
      "Joinville",
      "Blumenau",
      "São José",
      "Criciúma",
      "Chapecó",
      "Itajaí",
      "Lages",
      "Jaraguá do Sul",
      "Palhoça"
    ],
    "Goiás": [
      "Goiânia",
      "Aparecida de Goiânia",
      "Anápolis",
      "Rio Verde",
      "Luziânia",
      "Águas Lindas de Goiás",
      "Valparaíso de Goiás",
      "Trindade",
      "Formosa",
      "Novo Gama"
    ],
    "Maranhão": [
      "São Luís",
      "Imperatriz",
      "Caxias",
      "Timon",
      "Codó",
      "Paço do Lumiar",
      "Açailândia",
      "Bacabal",
      "Balsas",
      "Santa Inês"
    ],
    "Paraíba": [
      "João Pessoa",
      "Campina Grande",
      "Santa Rita",
      "Patos",
      "Bayeux",
      "Sousa",
      "Cajazeiras",
      "Guarabira",
      "Mamanguape",
      "Monteiro"
    ],
    "Espírito Santo": [
      "Vitória",
      "Vila Velha",
      "Cariacica",
      "Serra",
      "Cachoeiro de Itapemirim",
      "Linhares",
      "São Mateus",
      "Colatina",
      "Guarapari",
      "Aracruz"
    ],
    "Alagoas": [
      "Maceió",
      "Arapiraca",
      "Rio Largo",
      "Palmeira dos Índios",
      "União dos Palmares",
      "São Miguel dos Campos",
      "Penedo",
      "Coruripe",
      "Marechal Deodoro",
      "Santana do Ipanema"
    ],
    "Sergipe": [
      "Aracaju",
      "Nossa Senhora do Socorro",
      "Lagarto",
      "Itabaiana",
      "São Cristóvão",
      "Estância",
      "Propriá",
      "Simão Dias",
      "Tobias Barreto",
      "Canindé de São Francisco"
    ],
    "Distrito Federal": [
      "Brasília",
      "Ceilândia",
      "Taguatinga",
      "Samambaia",
      "Planaltina",
      "Gama",
      "Santa Maria",
      "São Sebastião",
      "Sobradinho",
      "Paranoá"
    ]
  },
  "Portugal": {
    "Lisboa": [
      "Lisboa",
      "Sintra",
      "Cascais",
      "Amadora",
      "Oeiras",
      "Loures",
      "Odivelas",
      "Vila Franca de Xira",
      "Mafra",
      "Torres Vedras"
    ],
    "Porto": [
      "Porto",
      "Vila Nova de Gaia",
      "Matosinhos",
      "Gondomar",
      "Valongo",
      "Paredes",
      "Penafiel",
      "Vila do Conde",
      "Póvoa de Varzim",
      "Maia"
    ],
    "Setúbal": [
      "Setúbal",
      "Almada",
      "Seixal",
      "Barreiro",
      "Moita",
      "Montijo",
      "Palmela",
      "Sesimbra",
      "Alcochete",
      "Sines"
    ],
    "Braga": [
      "Braga",
      "Guimarães",
      "Famalicão",
      "Barcelos",
      "Esposende",
      "Vizela",
      "Amares",
      "Celorico de Basto",
      "Fafe",
      "Vieira do Minho"
    ],
    "Aveiro": [
      "Aveiro",
      "Ovar",
      "Águeda",
      "Ílhavo",
      "Oliveira do Bairro",
      "Vagos",
      "Sever do Vouga",
      "Murtosa",
      "Anadia",
      "Estarreja"
    ],
    "Coimbra": [
      "Coimbra",
      "Figueira da Foz",
      "Cantanhede",
      "Montemor-o-Velho",
      "Soure",
      "Mira",
      "Condeixa-a-Nova",
      "Penacova",
      "Lousã",
      "Miranda do Corvo"
    ],
    "Faro": [
      "Faro",
      "Portimão",
      "Lagos",
      "Loulé",
      "Tavira",
      "Olhão",
      "Vila Real de Santo António",
      "Albufeira",
      "Silves",
      "Lagoa"
    ],
    "Leiria": [
      "Leiria",
      "Marinha Grande",
      "Caldas da Rainha",
      "Óbidos",
      "Peniche",
      "Nazaré",
      "Alcobaça",
      "Bombarral",
      "Torres Vedras",
      "Lourinhã"
    ],
    "Santarém": [
      "Santarém",
      "Tomar",
      "Torres Novas",
      "Abrantes",
      "Entroncamento",
      "Rio Maior",
      "Cartaxo",
      "Almeirim",
      "Chamusca",
      "Coruche"
    ],
    "Viseu": [
      "Viseu",
      "Lamego",
      "São Pedro do Sul",
      "Santa Comba Dão",
      "Tondela",
      "Mangualde",
      "Nelas",
      "Penalva do Castelo",
      "Sátão",
      "Vila Nova de Paiva"
    ],
    "Açores": [
      "Ponta Delgada",
      "Angra do Heroísmo",
      "Horta",
      "Ribeira Grande",
      "Lagoa",
      "Vila Franca do Campo",
      "Povoação",
      "Nordeste",
      "Praia da Vitória",
      "Velas"
    ],
    "Madeira": [
      "Funchal",
      "Câmara de Lobos",
      "Machico",
      "Ribeira Brava",
      "Ponta do Sol",
      "Calheta",
      "Santana",
      "São Vicente",
      "Porto Santo",
      "Porto Moniz"
    ]
  },
  "Moçambique": {
    "Maputo": [
      "Maputo",
      "Matola",
      "Boane",
      "Marracuene",
      "Namaacha",
      "Moamba",
      "Manhiça",
      "Magude",
      "Ressano Garcia"
    ],
    "Maputo (Cidade)": [
      "KaMpfumo",
      "Nlhamankulu",
      "KaMaxakeni",
      "KaMavota",
      "KaMubukwana",
      "KaTembe",
      "KaNyaka"
    ],
    "Gaza": [
      "Xai-Xai",
      "Chibuto",
      "Chókwè",
      "Macia",
      "Bilene",
      "Manjacaze",
      "Massingir",
      "Guijá",
      "Limpopo"
    ],
    "Inhambane": [
      "Inhambane",
      "Maxixe",
      "Vilanculos",
      "Panda",
      "Govuro",
      "Homoíne",
      "Jangamo",
      "Mabote",
      "Massinga"
    ],
    "Manica": [
      "Chimoio",
      "Manica",
      "Gondola",
      "Sussundenga",
      "Tambara",
      "Macate",
      "Vanduzi",
      "Mossurize",
      "Bárue"
    ],
    "Sofala": [
      "Beira",
      "Dondo",
      "Nhamatanda",
      "Gorongosa",
      "Marromeu",
      "Muanza",
      "Caia",
      "Chemba",
      "Machanga"
    ],
    "Tete": [
      "Tete",
      "Moatize",
      "Angónia",
      "Zumbo",
      "Changara",
      "Macanga",
      "Marávia",
      "Mutarara",
      "Tsangano"
    ],
    "Zambézia": [
      "Quelimane",
      "Mocuba",
      "Gurúè",
      "Milange",
      "Maganja da Costa",
      "Alto Molócuè",
      "Ile",
      "Inhassunge",
      "Lugela"
    ],
    "Nampula": [
      "Nampula",
      "Angoche",
      "Mozambique",
      "Nacala",
      "Monapo",
      "Mecubúri",
      "Muecate",
      "Moma",
      "Larde"
    ],
    "Cabo Delgado": [
      "Pemba",
      "Mocímboa da Praia",
      "Montepuez",
      "Mueda",
      "Muidumbe",
      "Nangade",
      "Palma",
      "Quissanga",
      "Macomia"
    ],
    "Niassa": [
      "Lichinga",
      "Cuamba",
      "Metangula",
      "Mandimba",
      "Marrupa",
      "Maua",
      "Mecanhelas",
      "Mecula",
      "Ngauma"
    ]
  },
  "Cabo Verde": {
    "Ilhas do Barlavento: Santiago": [
      "Praia",
      "Assomada",
      "Tarrafal",
      "Pedra Badejo",
      "São Domingos",
      "Santa Catarina",
      "São Salvador do Mundo",
      "Santa Cruz",
      "São Lourenço dos Órgãos"
    ],
    "Ilhas do Barlavento: São Vicente": [
      "Mindelo",
      "São Pedro",
      "Ribeira Brava"
    ],
    "Ilhas do Barlavento: Santo Antão": [
      "Porto Novo",
      "Ribeira Grande",
      "Paúl",
      "Ponta do Sol"
    ],
    "Ilhas do Barlavento: São Nicolau": [
      "Ribeira Brava",
      "Tarrafal de São Nicolau"
    ],
    "Ilhas do Barlavento: Sal": [
      "Espargos",
      "Santa Maria"
    ],
    "Ilhas do Barlavento: Boa Vista": [
      "Sal Rei",
      "Rabil"
    ],
    "Ilhas do Sotavento: Maio": [
      "Vila do Maio",
      "Calheta"
    ],
    "Ilhas do Sotavento: Fogo": [
      "São Filipe",
      "Mosteiros",
      "Santa Catarina do Fogo"
    ],
    "Ilhas do Sotavento: Brava": [
      "Nova Sintra",
      "Furna"
    ]
  },
  "Guiné-Bissau": {
    "Bissau": [
      "Bissau",
      "Safim",
      "Quinhámel"
    ],
    "Biombo": [
      "Quinhámel",
      "Prabis"
    ],
    "Bafatá": [
      "Bafatá",
      "Contuboel",
      "Galomaro"
    ],
    "Gabú": [
      "Gabú",
      "Pirada",
      "Sonaco"
    ],
    "Oio": [
      "Farim",
      "Mansabá",
      "Nhacra"
    ],
    "Cacheu": [
      "Cacheu",
      "Canchungo",
      "São Domingos"
    ],
    "Bolama": [
      "Bolama",
      "Bubaque",
      "Caravela"
    ],
    "Quinara": [
      "Fulacunda",
      "Buba"
    ],
    "Tombali": [
      "Catió",
      "Bedanda",
      "Quebo"
    ]
  },
  "São Tomé e Príncipe": {
    "Água Grande": [
      "São Tomé",
      "Trindade",
      "Neves"
    ],
    "Cantagalo": [
      "Santana",
      "Ribeira Afonso"
    ],
    "Caué": [
      "São João dos Angolares",
      "Porto Alegre"
    ],
    "Lembá": [
      "Neves",
      "Santa Catarina"
    ],
    "Lobata": [
      "Guadalupe",
      "Bombom"
    ],
    "Mé-Zóchi": [
      "Trindade",
      "Monte Café"
    ],
    "Príncipe": [
      "Santo António",
      "Sundy"
    ]
  },
  "Timor-Leste": {
    "Dili": [
      "Dili",
      "Metinaro",
      "Vera Cruz"
    ],
    "Baucau": [
      "Baucau",
      "Vemasse",
      "Laga"
    ],
    "Ermera": [
      "Gleno",
      "Atsabe",
      "Letefoho"
    ],
    "Liquiçá": [
      "Liquiçá",
      "Maubara",
      "Bazartete"
    ],
    "Manatuto": [
      "Manatuto",
      "Laclubar",
      "Lacluta"
    ],
    "Manufahi": [
      "Same",
      "Alas",
      "Fatuberliu"
    ],
    "Aileu": [
      "Aileu",
      "Laulara",
      "Lequidoe"
    ],
    "Ainaro": [
      "Ainaro",
      "Hato-Udo",
      "Maubisse"
    ],
    "Bobonaro": [
      "Maliana",
      "Lolotoe",
      "Atabae"
    ],
    "Cova-Lima": [
      "Suai",
      "Tilomar",
      "Zumalai"
    ],
    "Lautém": [
      "Lospalos",
      "Iliomar",
      "Tutuala"
    ],
    "Oecusse": [
      "Pante Macassar",
      "Nitibe",
      "Oesilo"
    ],
    "Viqueque": [
      "Viqueque",
      "Uato-Lari",
      "Uato-Carbau"
    ]
  },
  "Guiné Equatorial": {
    "Bioko Norte": [
      "Malabo",
      "Rebola",
      "Baney"
    ],
    "Bioko Sur": [
      "Luba",
      "Riaba"
    ],
    "Litoral": [
      "Bata",
      "Mbini",
      "Cogo"
    ],
    "Centro Sur": [
      "Evinayong",
      "Niefang",
      "Aconibe"
    ],
    "Kié-Ntem": [
      "Ebebiyín",
      "Mongomo",
      "Micomeseng"
    ],
    "Wele-Nzas": [
      "Mongomo",
      "Añisoc",
      "Nsok"
    ],
    "Annobón": [
      "San Antonio de Palé",
      "San Pedro"
    ]
  }
};

export const getMunicipiosByProvince = (country: string, province: string): string[] => {
  if (!PROVINCES_MUNICIPIOS[country]) {
    return [];
  }
  return PROVINCES_MUNICIPIOS[country][province] || [];
};

