# Scientific Integrity and Reproducibility

## Principle

A GUI can appear correct while changing scientific meaning. Scientific validation therefore targets domain behavior and provenance, not only visual output.

## Preserve at domain boundaries

For relevant inputs, transformations and outputs preserve explicitly:

- physical quantity and units;
- sign, indexing and ordering conventions;
- precision, rounding and missing-value behavior;
- source/provenance and transformation history;
- software/algorithm configuration;
- convergence state, warnings and failure interpretation.

## Separation rule

Prefer this dependency direction unless an accepted ADR states otherwise:

```text
GUI/presentation -> application/bridge -> scientific/domain layer
                                  \-> infrastructure/file/process adapters
```

Scientific/domain behavior should be testable without requiring the live GUI where practical.

## JCO-GUI specific scientific checks

Changes touching any of the following normally require explicit scientific-consistency review:

- device parameters and units;
- physical sources/drives and amplitudes;
- fixed/range/list/function sweep semantics;
- linear, optimization and harmonic-balance stage selection;
- metric role/direction/unit semantics;
- `.jco` serialization/deserialization of scientific configuration;
- Julia bridge arguments and returned metadata;
- HDF5/result filtering, pivoting, interpolation, aggregation or masking;
- nonlinear feedback inputs or other transformations that can change the interpreted physical result.

## Reference validation

For a critical scientific claim define, before declaring it validated:

1. reference dataset or analytic case;
2. provenance;
3. exact input/configuration;
4. expected output;
5. numerical/qualitative tolerance and rationale;
6. known limitations;
7. retained evidence/version.

Golden files are not independent validation if they were generated only by the implementation under test.

## Numerical behavior

Record as applicable deterministic/stochastic behavior and seed, NaN/Inf handling, interpolation/extrapolation policy, convergence limits, platform sensitivity, and significant-digit/reporting conventions.

## Scientific release gate

A release that changes scientific output or interpretation must not be described as scientifically validated until the relevant reference/tolerance checks have actually been performed and retained.
