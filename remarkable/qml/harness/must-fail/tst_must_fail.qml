// The gate's self-check of the QML runner (reader.qml_harness): this test
// fails on purpose, and scripts/gate passes only when the runner says so with
// a non-zero exit. It lives outside qml/tests/, the runner's real input.
import QtTest

TestCase {
    name: "MustFail"

    function test_fails() {
        compare(1, 2, "the runner must report this failure");
    }
}
