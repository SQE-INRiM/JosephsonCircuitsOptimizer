# Revisione rapida dell’input Carthago

Queste note riguardano il progetto fornito, non dimostrano errori fisici. Sono i punti da verificare prima di trasformare il prototipo GUI in un flusso di produzione.

## Priorità alta

1. **Plot e salvataggi dentro le funzioni di metrica.** `user_cost` crea due grafici, chiama `plot_update` e salva tre dataset a ogni valutazione; `user_performance` crea e mostra un grafico a ogni punto HB e stampa anche un risultato nonlineare. Durante sweep e ottimizzazione questo può dominare il tempo, produrre migliaia di file e creare problemi in esecuzione headless. Le metriche dovrebbero restituire solo dati; visualizzazione e persistenza devono avvenire una volta, nello strato JCO.

2. **La correzione nonlineare ricevuta viene annullata.** In `user_cost`, l’argomento `nonlinear_correction` viene sovrascritto con `0`, quindi non può influenzare la metrica. Inoltre `n_iterations_nonlinear_correction` è zero: oggi l’intero percorso è di fatto disattivato. Va rimosso oppure riattivato con un test end-to-end.

3. **Frequenze hard-coded non coerenti.** `user_performance` usa `fp = 7e9` invece di `source_freqs[1]`; la correzione nonlineare usa 5.75 e 11.5 GHz, valori che sembrano appartenere a un’altra pompa rispetto ai 7 GHz configurati. Tutte le bande devono derivare dalle sorgenti/configurazione e venire validate rispetto alla griglia simulata.

4. **Dipendenza da stato globale.** Metriche e utility leggono `sim_vars` globalmente. Questo rende difficile testare le funzioni, eseguire run concorrenti e capire quali input invalidano i risultati. Passare esplicitamente frequenze, sorgenti e griglia angolare in un contesto immutabile.

## Priorità media

5. **Fit con uguaglianza esatta fra float.** `plot_dispersion_relation` cerca 0.06 e 0.5 GHz con `findfirst(x -> x == value)`. Se la griglia cambia può restituire `nothing`. La versione “full” usa già `argmin(abs.(...))`, che è più robusta; conviene centralizzare questa logica e controllare anche che l’intervallo sia presente.

6. **Metrica di impedenza fragile vicino a 0 dB.** `5 / abs(mean(S11_dB))` diverge quando la riflessione media si avvicina a 0 dB e media direttamente valori in dB. Può essere intenzionale, ma è meglio definire esplicitamente una loss normalizzata/limitata e testarne monotonicità, unità e comportamento ai bordi.

7. **Configurazione non completamente riproducibile.** Lo spread di fabbricazione ha seed fisso nel codice, mentre il campionamento casuale dell’ottimizzatore non dichiara un seed nel JSON. Seed e realizzazione dello spread devono entrare nei metadati del run. Il seed fisso per ogni design usa la stessa realizzazione normalizzata, utile per confronti a basso rumore, ma non misura la robustezza statistica: per quella servono più realizzazioni.

8. **Costanti fisiche nascoste nel circuito.** `Ladd`, `Lf`, `Cf`, `Lg`, `kappa`, loss tangent e deviazioni standard sono hard-coded. Anche se non devono essere ottimizzabili, vanno salvate come parametri di modello versionati e mostrate read-only nella GUI, altrimenti una loro modifica non è evidente nella provenienza.

9. **Output delle metriche non strutturato.** Le funzioni restituiscono un solo scalare e salvano tracce con side effect. Per la nuova GUI servono risultati nominati: objective, diagnostiche, vincoli, performance, assi, unità e maschera di convergenza. Questo evita di dedurre il significato dalla posizione di una colonna.

## Pulizia utile

- Eliminare variabili calcolate ma non usate (`S21`, alcune fasi, `maxS11band`, `Ic2_ref`) e grandi blocchi commentati una volta trasferiti nella cronologia Git.
- Correggere nomi generici come `length`, che ombreggia la funzione Julia omonima, usando per esempio `n_cells`.
- Separare funzioni numeriche pure da helper `plot_*`; `user_metric_utils.jl` può restare un modulo avanzato, ma non dovrebbe essere necessario per calcolare ogni metrica base.
- Validare prima del run che bande, idler e armoniche richieste siano contenute nella griglia di frequenza.

## Primo refactoring consigliato

Creare funzioni pure `linear_metrics(S, context)` e `hb_metrics(sol, context)` che restituiscano una struttura nominata con scalari e tracce selezionate. Aggiungere test con piccoli array sintetici per bande, conversioni dB, phase unwrap e mismatch; soltanto dopo collegare il writer `.jco` e la GUI.

