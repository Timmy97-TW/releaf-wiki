const int PIN_LIGHT1 = 9;
const int PIN_LIGHT2 = 10;
const int PIN_LIGHT3 = 11;
int x=0;
void setup() {
  pinMode(PIN_LIGHT1, OUTPUT);
  pinMode(PIN_LIGHT2, OUTPUT);
  pinMode(PIN_LIGHT3, OUTPUT);
}

void loop() {
  analogWrite(PIN_LIGHT1, 5);   // ~2% duty cycle
  analogWrite(PIN_LIGHT2, 31);  // ~12% duty cycle
  analogWrite(PIN_LIGHT3, 255);  // 100% duty cycle

}