import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Switch, Pressable, ScrollView,
  ActivityIndicator, StyleSheet, Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { getOptions, predict, Options, Prediction } from "../services/api";

const C = {
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  bg: "#F3F4F8",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  error: "#DC2626",
  errorBg: "#FEE2E2",
};

// Une couleur par gamme de prix
const CLASS_STYLE: Record<string, { color: string; bg: string; emoji: string }> = {
  "Économique":    { color: "#059669", bg: "#D1FAE5", emoji: "🏠" },
  "Intermédiaire": { color: "#2563EB", bg: "#DBEAFE", emoji: "🏡" },
  "Haut de gamme": { color: "#7C3AED", bg: "#EDE9FE", emoji: "🏢" },
  "Luxe":          { color: "#D97706", bg: "#FEF3C7", emoji: "🏰" },
};
const fallbackStyle = { color: C.primary, bg: "#E0E7FF", emoji: "🏠" };

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label} {required && <Text style={{ color: C.error }}>*</Text>}
      </Text>
      {children}
    </View>
  );
}

function Select({ value, onChange, items }: {
  value: string; onChange: (v: string) => void; items: string[];
}) {
  return (
    <View style={s.pickerBox}>
      <Picker
        selectedValue={value}
        onValueChange={onChange}
        style={Platform.OS === "android" ? { color: C.text } : undefined}
        dropdownIconColor={C.muted}
      >
        <Picker.Item label="Choisir..." value="" color={C.muted} />
        {items.map((i) => <Picker.Item key={i} label={i} value={i} />)}
      </Picker>
    </View>
  );
}

export default function Index() {
  const [options, setOptions] = useState<Options | null>(null);

  const [community, setCommunity] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [size, setSize] = useState("");

  const [furnished, setFurnished] = useState(false);
  const [verified, setVerified] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOptions().then(setOptions).catch((e) => setError(e.message));
  }, []);

  const submit = async () => {
    setError("");
    setResult(null);

    const sqft = parseFloat(size);
    if (!community || !bedrooms || !bathrooms || !sqft || sqft <= 0) {
      setError("Renseigne le quartier, les chambres, les salles de bain et la surface.");
      return;
    }

    setLoading(true);
    try {
      setResult(
        await predict({
          community, bedrooms, bathrooms,
          size_sqft: sqft, furnished, verified, title, description,
        })
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!options) {
    return (
      <View style={s.center}>
        {error ? (
          <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
        ) : (
          <ActivityIndicator size="large" color={C.primary} />
        )}
      </View>
    );
  }

  const top = result ? CLASS_STYLE[result.predicted_class] ?? fallbackStyle : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}
                keyboardShouldPersistTaps="handled">
      {/* En-tête */}
      <View style={s.header}>
        <Text style={s.headerEmoji}>🏙️</Text>
        <Text style={s.headerTitle}>Dubai Property</Text>
        <Text style={s.headerSub}>Estime la gamme de prix d'un bien</Text>
      </View>

      {/* Infos principales */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Le bien</Text>
        <Field label="Quartier" required>
          <Select value={community} onChange={setCommunity} items={options.communities} />
        </Field>
        <Field label="Chambres" required>
          <Select value={bedrooms} onChange={setBedrooms} items={options.bedrooms} />
        </Field>
        <Field label="Salles de bain" required>
          <Select value={bathrooms} onChange={setBathrooms} items={options.bathrooms} />
        </Field>
        <Field label="Surface (sqft)" required>
          <TextInput
            style={s.input}
            keyboardType="numeric"
            value={size}
            onChangeText={setSize}
            placeholder="ex : 1300"
            placeholderTextColor={C.muted}
          />
        </Field>
      </View>

      {/* Options */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Détails (facultatif)</Text>

        <View style={s.switchRow}>
          <Text style={s.switchLabel}>🛋️  Meublé</Text>
          <Switch value={furnished} onValueChange={setFurnished}
                  trackColor={{ true: C.primary, false: C.border }} />
        </View>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>✅  Annonce vérifiée</Text>
          <Switch value={verified} onValueChange={setVerified}
                  trackColor={{ true: C.primary, false: C.border }} />
        </View>

        <Field label="Titre de l'annonce">
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="ex : Vue canal | Étage élevé"
            placeholderTextColor={C.muted}
          />
        </Field>
        <Field label="Description">
          <TextInput
            style={[s.input, s.textarea]}
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="ex : piscine, parking, salle de sport..."
            placeholderTextColor={C.muted}
          />
        </Field>
      </View>

      {/* Bouton */}
      <Pressable
        onPress={submit}
        disabled={loading}
        style={({ pressed }) => [
          s.button,
          pressed && { backgroundColor: C.primaryDark },
          loading && { opacity: 0.7 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.buttonText}>Estimer la gamme</Text>
        )}
      </Pressable>

      {!!error && (
        <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
      )}

      {/* Résultat */}
      {result && top && (
        <View style={[s.card, { borderWidth: 2, borderColor: top.color }]}>
          <View style={[s.badge, { backgroundColor: top.bg }]}>
            <Text style={s.badgeEmoji}>{top.emoji}</Text>
            <Text style={[s.badgeText, { color: top.color }]}>
              {result.predicted_class}
            </Text>
          </View>
          <Text style={s.confidence}>
            Confiance du modèle : {(result.confidence * 100).toFixed(0)} %
          </Text>

          {Object.entries(result.probabilities)
            .sort((a, b) => b[1] - a[1])
            .map(([k, p]) => {
              const st = CLASS_STYLE[k] ?? fallbackStyle;
              return (
                <View key={k} style={{ marginTop: 12 }}>
                  <View style={s.probRow}>
                    <Text style={s.probName}>{k}</Text>
                    <Text style={s.probValue}>{(p * 100).toFixed(1)} %</Text>
                  </View>
                  <View style={s.track}>
                    <View style={[s.fill, { width: `${p * 100}%`, backgroundColor: st.color }]} />
                  </View>
                </View>
              );
            })}

          <Text style={s.note}>
            Estimation indicative, basée sur des annonces de 2024.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  container: { paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: C.bg },

  header: {
    backgroundColor: C.primary,
    paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginBottom: 16,
  },
  headerEmoji: { fontSize: 36 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", marginTop: 4 },
  headerSub: { fontSize: 15, color: "#C7D2FE", marginTop: 4 },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 4 },

  field: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: "600", color: C.muted, marginBottom: 6 },
  pickerBox: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    backgroundColor: "#FAFAFB", overflow: "hidden",
  },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    backgroundColor: "#FAFAFB", paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: C.text,
  },
  textarea: { height: 100, textAlignVertical: "top" },

  switchRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  switchLabel: { fontSize: 15, color: C.text },

  button: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    marginHorizontal: 16, alignItems: "center", marginBottom: 16,
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  errorBox: {
    backgroundColor: C.errorBg, borderRadius: 10, padding: 12,
    marginHorizontal: 16, marginBottom: 16,
  },
  errorText: { color: C.error, fontSize: 14 },

  badge: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  badgeEmoji: { fontSize: 22, marginRight: 8 },
  badgeText: { fontSize: 22, fontWeight: "800" },
  confidence: { marginTop: 10, color: C.muted, fontSize: 14 },

  probRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  probName: { color: C.text, fontSize: 14, fontWeight: "600" },
  probValue: { color: C.muted, fontSize: 14 },
  track: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },

  note: { marginTop: 16, fontSize: 12, color: C.muted, fontStyle: "italic" },
});