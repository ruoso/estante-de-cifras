// The QML harness's own test (reader.qml_harness): a component written
// against AppLoad's surface is driven by design §6's messages played into the
// stand-in, and what it sent is read back.
import QtQuick
import QtTest

TestCase {
    id: testCase
    name: "Harness"
    when: windowShown
    width: 400
    height: 100

    Component {
        id: probeComponent
        HarnessProbe {}
    }

    function stateMessage(fields) {
        return Object.assign({ paired: false, syncing: false, online: true,
                               lastSync: null, shapesShown: true }, fields);
    }

    // Design §6 `1 hello`: the frontend says hello when it attaches, with
    // AppLoad's sendMessage(int, QString) — recorded once, spied once.
    function test_helloOnAttach() {
        const probe = createTemporaryObject(spiedProbeComponent, testCase);
        const spy = probe.spy;
        const endpoint = probe.endpoint;
        compare(endpoint.sent.length, 1);
        compare(endpoint.sent[0].type, 1);
        compare(endpoint.sent[0].contents, "{}");
        compare(endpoint.sent[0].payload, {});
        compare(spy.count, 1);
        compare(spy.signalArguments[0][0], 1);
        compare(spy.signalArguments[0][1], "{}");
    }

    // Design §6 `101 state`, §3.3: the frontend draws what it is sent.
    function test_answersScriptedState() {
        const probe = createTemporaryObject(probeComponent, testCase);
        compare(probe.label.text, "Not paired");
        probe.endpoint.play(101, stateMessage({ paired: true }));
        compare(probe.label.text, "Paired");
        probe.endpoint.play(101, stateMessage({ paired: false }));
        compare(probe.label.text, "Not paired");
    }

    // Design §6: each side ignores a type it does not know, and a field it
    // does not know.
    function test_unknownIgnored() {
        const probe = createTemporaryObject(probeComponent, testCase);
        probe.endpoint.play(101, stateMessage({ paired: true }));
        probe.endpoint.clear();
        probe.endpoint.play(199, { paired: false });
        compare(probe.label.text, "Paired");
        probe.endpoint.play(101, stateMessage({ paired: true, somethingNew: 42 }));
        compare(probe.label.text, "Paired");
        compare(probe.endpoint.sent.length, 0);
    }

    // rm-appload src/AppLoad.h: sendMessage(int, QString) — the stand-in
    // refuses what the real one would mangle on the way to the backend.
    function test_standInRefusesNonString() {
        const probe = createTemporaryObject(probeComponent, testCase);
        probe.endpoint.clear();
        let threw = false;
        try { probe.endpoint.sendMessage(1, {}); } catch (e) { threw = true; }
        verify(threw, "an object payload throws");
        threw = false;
        try { probe.endpoint.sendMessage("1", "{}"); } catch (e) { threw = true; }
        verify(threw, "a string type throws");
        compare(probe.endpoint.sent.length, 0);
    }

    // The rM2 has no GPU: design §9, Qt Quick's software renderer offscreen.
    function test_softwareRenderer() {
        const probe = createTemporaryObject(probeComponent, testCase);
        compare(probe.graphicsApi, GraphicsInfo.Software);
    }

    // The spy has to be listening before the probe attaches: declared with
    // the probe, its target binding is set before the probe's
    // Component.onCompleted says hello.
    Component {
        id: spiedProbeComponent
        HarnessProbe {
            id: spied
            readonly property SignalSpy spy: SignalSpy {
                target: spied.endpoint
                signalName: "messageSent"
            }
        }
    }
}
