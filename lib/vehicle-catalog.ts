/**
 * Catálogo de marcas y modelos de vehículos
 * Marcas populares en México
 */

export interface VehicleBrand {
    value: string;
    label: string;
    models: string[];
}

export const VEHICLE_BRANDS: VehicleBrand[] = [
    {
        value: "nissan",
        label: "Nissan",
        models: ["Versa", "Sentra", "Altima", "Kicks", "X-Trail", "Pathfinder", "March", "Note", "Frontier", "NP300", "370Z", "GT-R", "Tsuru", "Platina", "Tiida", "Aprio", "Urvan", "Maxima"]
    },
    {
        value: "toyota",
        label: "Toyota",
        models: ["Corolla", "Camry", "Yaris", "Hilux", "Tacoma", "RAV4", "4Runner", "Prius", "Avanza", "Sienna", "Tercel", "Starlet", "Celica", "Supra", "Tundra"]
    },
    {
        value: "chevrolet",
        label: "Chevrolet",
        models: ["Aveo", "Beat", "Onix", "Cavalier", "Malibu", "Cruze", "Trax", "Equinox", "Tahoe", "Suburban", "Silverado", "Camaro", "Corvette", "Chevy", "Spark", "S-10"]
    },
    {
        value: "volkswagen",
        label: "Volkswagen",
        models: ["Vento", "Jetta", "Golf", "Polo", "Beetle", "Passat", "Tiguan", "Touareg", "Amarok", "Derby", "Pointer", "Gol", "Combi"]
    },
    {
        value: "honda",
        label: "Honda",
        models: ["Civic", "Accord", "City", "CR-V", "HR-V", "Pilot", "Odyssey", "Fit", "CRX", "Prelude", "Integra", "S2000"]
    },
    {
        value: "mazda",
        label: "Mazda",
        models: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-9", "CX-30", "CX-50", "MX-5"]
    },
    {
        value: "kia",
        label: "Kia",
        models: ["Rio", "Forte", "K5", "Seltos", "Sportage", "Sorento", "Carnival", "Soul", "Stinger", "Optima"]
    },
    {
        value: "hyundai",
        label: "Hyundai",
        models: ["Accent", "Elantra", "Sonata", "Venue", "Creta", "Tucson", "Santa Fe", "Palisade", "Veloster", "Ioniq"]
    },
    {
        value: "ford",
        label: "Ford",
        models: ["Figo", "Fiesta", "Focus", "Fusion", "Escape", "Explorer", "Edge", "Expedition", "F-150", "Ranger", "Mustang", "Bronco", "Ka"]
    },
    {
        value: "seat",
        label: "SEAT",
        models: ["Ibiza", "León", "Toledo", "Arona", "Ateca", "Tarraco"]
    },
    {
        value: "renault",
        label: "Renault",
        models: ["Captur", "Clio", "Logan", "Sandero", "Stepway", "Kwid", "Duster", "Koleos", "Oroch"]
    },
    {
        value: "suzuki",
        label: "Suzuki",
        models: ["Swift", "Baleno", "Vitara", "Ignis", "Ciaz", "S-Cross", "Jimny"]
    },
    {
        value: "mitsubishi",
        label: "Mitsubishi",
        models: ["Mirage", "Outlander", "Eclipse Cross", "L200", "Montero", "ASX"]
    },
    {
        value: "peugeot",
        label: "Peugeot",
        models: ["208", "301", "2008", "3008", "5008", "Partner", "Rifter"]
    },
    {
        value: "fiat",
        label: "Fiat",
        models: ["Uno", "Palio", "500", "Mobi", "Argo", "Cronos", "Toro", "Ducato"]
    },
    {
        value: "dodge",
        label: "Dodge",
        models: ["Attitude", "Neon", "Challenger", "Charger", "Durango", "Ram", "Atos", "Stratus", "Dakota"]
    },
    {
        value: "jeep",
        label: "Jeep",
        models: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator"]
    },
    {
        value: "bmw",
        label: "BMW",
        models: ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "Serie 7", "X1", "X3", "X5", "X6", "X7", "Z4"]
    },
    {
        value: "mercedes",
        label: "Mercedes-Benz",
        models: ["Clase A", "Clase C", "Clase E", "Clase S", "GLA", "GLB", "GLC", "GLE", "GLS"]
    },
    {
        value: "audi",
        label: "Audi",
        models: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "TT", "R8"]
    },
    {
        value: "byd",
        label: "BYD",
        models: ["Dolphin", "Seal", "Atto 3", "Han", "Tang", "Song Plus", "Yuan Plus", "Qin"]
    },
    {
        value: "mg",
        label: "MG",
        models: ["MG5", "MG6", "MG ZS", "MG RX5", "MG HS", "MG GT", "MG ONE"]
    },
    {
        value: "chery",
        label: "Chery",
        models: ["Tiggo 2", "Tiggo 3", "Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo 5", "Omoda 5"]
    },
    {
        value: "changan",
        label: "Changan",
        models: ["CS15", "CS35", "CS55", "CS75", "Alsvin", "Hunter"]
    },
    {
        value: "jac",
        label: "JAC",
        models: ["S2", "S3", "S4", "S7", "T6", "T8", "E10X"]
    },
    {
        value: "tesla",
        label: "Tesla",
        models: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"]
    }
];

export interface VehicleSearchResult {
    brand: { value: string; label: string };
    model: string;
}

/**
 * Busca marcas y modelos que coincidan con el término de búsqueda
 */
export function searchVehicles(searchTerm: string): VehicleSearchResult[] {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const normalizedSearch = searchTerm.toLowerCase().trim();
    const results: VehicleSearchResult[] = [];

    for (const brand of VEHICLE_BRANDS) {
        // Buscar en modelos
        const matchingModels = brand.models.filter(model =>
            model.toLowerCase().includes(normalizedSearch)
        );

        // Agregar resultados
        matchingModels.forEach(model => {
            results.push({
                brand: { value: brand.value, label: brand.label },
                model
            });
        });

        // También buscar si el término coincide con la marca
        if (brand.label.toLowerCase().includes(normalizedSearch)) {
            // Agregar los primeros 3 modelos de esa marca
            brand.models.slice(0, 3).forEach(model => {
                if (!results.find(r => r.brand.value === brand.value && r.model === model)) {
                    results.push({
                        brand: { value: brand.value, label: brand.label },
                        model
                    });
                }
            });
        }
    }

    return results.slice(0, 8); // Limitar a 8 resultados
}

/**
 * Obtiene los modelos para una marca específica
 */
export function getModelsForBrand(brandValue: string): string[] {
    const brand = VEHICLE_BRANDS.find(b => b.value === brandValue);
    return brand?.models || [];
}

/**
 * Obtiene las opciones de marcas para un selector
 */
export function getBrandOptions() {
    return VEHICLE_BRANDS.map(b => ({ value: b.value, label: b.label }));
}
